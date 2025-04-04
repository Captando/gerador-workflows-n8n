/**
 * @file app.js
 * @author Victor
 * @description Servidor Express completo para geração de workflows no n8n,
 * onde a única alteração é trocar a URL do node webhook "Entrada"
 */

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Importa as integrações reais com o n8n
const GeradorWorkflow = require('./gerador-workflow');
const { importarWorkflow, ativarWorkflow } = require('./integracao-n8n');

const app = express();
const PORTA = process.env.PORT || 5656;

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));

// Diretórios de arquivos
const diretorioSaida = path.join(__dirname, 'workflows-gerados');
const diretorioTemplates = path.join(__dirname, 'templates');

// Cria diretórios se não existirem
[diretorioSaida, diretorioTemplates].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
        console.log(`Diretório criado: ${dir}`);
    }
});

// Configura o multer para upload de arquivos
const armazenamento = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, diretorioTemplates);
    },
    filename: function (req, file, cb) {
        const nomeBase = path.basename(file.originalname, path.extname(file.originalname));
        const extensao = path.extname(file.originalname).toLowerCase();

        if (fs.existsSync(path.join(diretorioTemplates, file.originalname))) {
            const timestamp = Date.now();
            cb(null, `${nomeBase}-${timestamp}${extensao}`);
        } else {
            cb(null, file.originalname);
        }
    }
});

const upload = multer({
    storage: armazenamento,
    fileFilter: function (req, file, cb) {
        if (path.extname(file.originalname).toLowerCase() !== '.json') {
            return cb(new Error('Apenas arquivos JSON são permitidos'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // Limite de 10MB
    }
});

// Template padrão inicial
let caminhoTemplatePadrao = path.join(diretorioTemplates, 'template-padrao.json');

// Se não tiver nenhum template, cria um padrão com o node "Entrada"
if (fs.readdirSync(diretorioTemplates).filter(arq => arq.endsWith('.json')).length === 0) {
    const templateVazio = {
        name: "Template Padrão",
        nodes: [
            {
                name: "Entrada",
                parameters: {
                    path: "webhook-padrao",
                    httpMethod: "POST"
                },
                type: "n8n-nodes-base.webhook",
                position: [0, 0]
            }
        ],
        connections: {}
    };

    fs.writeFileSync(caminhoTemplatePadrao, JSON.stringify(templateVazio, null, 2));
    console.log(`Template padrão criado em ${caminhoTemplatePadrao}`);
} else {
    // Se tiver templates, usa o primeiro como padrão
    const templates = fs.readdirSync(diretorioTemplates)
        .filter(arquivo => arquivo.endsWith('.json'));

    if (templates.length > 0) {
        caminhoTemplatePadrao = path.join(diretorioTemplates, templates[0]);
        console.log(`Usando template existente como padrão: ${caminhoTemplatePadrao}`);
    }
}

/**
 * Classe que gera o workflow baseado no template,
 * alterando somente a URL do node "Entrada"
 */
class GeradorWorkflowModificado extends GeradorWorkflow {
    // Cria o workflow clonando o template e atualiza o node "Entrada"
    criarWorkflow(nomeWorkflow, caminhoWebhook) {
        // Clone profundo do template
        const workflow = JSON.parse(JSON.stringify(this.template));
        workflow.name = nomeWorkflow;

        // Localiza o node "Entrada" e atualiza a URL do webhook
        const nodeEntrada = workflow.nodes.find(node => node.name === "Entrada" && node.type === "n8n-nodes-base.webhook");
        if (!nodeEntrada) {
            throw new Error('Node "Entrada" não encontrado no template.');
        }
        nodeEntrada.parameters.path = caminhoWebhook;
        return workflow;
    }
}

// Inicializa gerador de workflow com o template padrão
let gerador = new GeradorWorkflowModificado(caminhoTemplatePadrao);

/* -------------------- Endpoints -------------------- */

// Upload de template
app.post('/api/templates/upload', upload.single('arquivo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                erro: 'Nenhum arquivo enviado',
                mensagem: 'É necessário enviar um arquivo JSON'
            });
        }

        const arquivoTemplate = req.file;

        // Verifica se o arquivo é um JSON válido
        try {
            const conteudo = fs.readFileSync(arquivoTemplate.path, 'utf8');
            JSON.parse(conteudo);
        } catch (erro) {
            fs.unlinkSync(arquivoTemplate.path);
            return res.status(400).json({
                erro: 'Arquivo JSON inválido',
                mensagem: 'O arquivo enviado não é um JSON válido'
            });
        }

        res.status(201).json({
            sucesso: true,
            mensagem: 'Template enviado com sucesso',
            dados: {
                nome: arquivoTemplate.filename,
                caminho: arquivoTemplate.path,
                tamanho: arquivoTemplate.size
            }
        });
    } catch (erro) {
        console.error('Erro ao processar upload de template:', erro);
        res.status(500).json({
            erro: 'Falha ao processar upload',
            mensagem: erro.message
        });
    }
});

// Listar templates disponíveis
app.get('/api/templates', (req, res) => {
    try {
        const arquivos = fs.readdirSync(diretorioTemplates);
        const templates = arquivos
            .filter(arquivo => arquivo.endsWith('.json'))
            .map(arquivo => {
                const caminhoArquivo = path.join(diretorioTemplates, arquivo);
                const stats = fs.statSync(caminhoArquivo);

                return {
                    nome: arquivo,
                    caminho: caminhoArquivo,
                    tamanho: stats.size,
                    dataCriacao: stats.birthtime,
                    templateAtivo: caminhoArquivo === gerador.caminhoTemplate
                };
            });

        res.status(200).json({
            sucesso: true,
            quantidade: templates.length,
            dados: templates
        });
    } catch (erro) {
        console.error('Erro ao listar templates:', erro);
        res.status(500).json({
            erro: 'Falha ao listar templates',
            mensagem: erro.message
        });
    }
});

// Selecionar template ativo
app.post('/api/templates/selecionar/:nomeArquivo', (req, res) => {
    try {
        const { nomeArquivo } = req.params;
        const caminhoArquivo = path.join(diretorioTemplates, nomeArquivo);

        if (!fs.existsSync(caminhoArquivo)) {
            return res.status(404).json({
                erro: 'Template não encontrado',
                mensagem: `Nenhum template encontrado com o nome: ${nomeArquivo}`
            });
        }

        try {
            gerador = new GeradorWorkflowModificado(caminhoArquivo);
            res.status(200).json({
                sucesso: true,
                mensagem: 'Template selecionado com sucesso',
                dados: {
                    nome: nomeArquivo,
                    caminho: caminhoArquivo
                }
            });
        } catch (erro) {
            return res.status(400).json({
                erro: 'Erro ao carregar template',
                mensagem: erro.message
            });
        }
    } catch (erro) {
        console.error('Erro ao selecionar template:', erro);
        res.status(500).json({
            erro: 'Falha ao selecionar template',
            mensagem: erro.message
        });
    }
});

// Criar e salvar workflow (apenas atualizando a URL do node "Entrada")
app.post('/api/workflows', (req, res) => {
    try {
        const { nomeWorkflow, caminhoWebhook } = req.body;
        if (!nomeWorkflow || !caminhoWebhook) {
            return res.status(400).json({
                erro: 'Parâmetros obrigatórios ausentes: nomeWorkflow e caminhoWebhook são obrigatórios'
            });
        }

        const workflow = gerador.criarWorkflow(nomeWorkflow, caminhoWebhook);
        const timestamp = Date.now();
        const nomeSanitizado = nomeWorkflow.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const nomeArquivo = `${nomeSanitizado}-${timestamp}.json`;
        const caminhoDeSaida = path.join(diretorioSaida, nomeArquivo);

        gerador.salvarWorkflow(workflow, caminhoDeSaida);

        res.status(201).json({
            sucesso: true,
            mensagem: 'Workflow criado com sucesso',
            dados: {
                nomeWorkflow,
                caminhoWebhook,
                nomeArquivo,
                caminho: caminhoDeSaida
            }
        });
    } catch (erro) {
        console.error('Erro ao gerar workflow:', erro);
        res.status(500).json({
            erro: 'Falha ao gerar workflow',
            mensagem: erro.message
        });
    }
});

// Criar, salvar e importar workflow para o n8n (com atualização do node "Entrada")
app.post('/api/workflows/importar', async (req, res) => {
    try {
        const { nomeWorkflow, caminhoWebhook, urlN8n, chaveApiN8n, ativar = false } = req.body;
        if (!nomeWorkflow || !caminhoWebhook) {
            return res.status(400).json({
                erro: 'Parâmetros obrigatórios ausentes: nomeWorkflow e caminhoWebhook são obrigatórios'
            });
        }
        if (!urlN8n || !chaveApiN8n) {
            return res.status(400).json({
                erro: 'Parâmetros obrigatórios ausentes: urlN8n e chaveApiN8n são obrigatórios'
            });
        }

        const workflow = gerador.criarWorkflow(nomeWorkflow, caminhoWebhook);
        const timestamp = Date.now();
        const nomeSanitizado = nomeWorkflow.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const nomeArquivo = `${nomeSanitizado}-${timestamp}.json`;
        const caminhoDeSaida = path.join(diretorioSaida, nomeArquivo);

        gerador.salvarWorkflow(workflow, caminhoDeSaida);

        // Importa o workflow para o n8n usando a função real
        const resultadoImportacao = await importarWorkflow(workflow, urlN8n, chaveApiN8n);
        if (!resultadoImportacao.sucesso) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Erro ao importar workflow para o n8n',
                erro: resultadoImportacao.erro,
                detalhes: resultadoImportacao.detalhes
            });
        }

        let resultadoAtivacao = null;
        if (ativar && resultadoImportacao.id) {
            resultadoAtivacao = await ativarWorkflow(resultadoImportacao.id, urlN8n, chaveApiN8n);
        }

        res.status(201).json({
            sucesso: true,
            mensagem: 'Workflow criado e importado com sucesso',
            dados: {
                nomeWorkflow,
                caminhoWebhook,
                nomeArquivo,
                caminho: caminhoDeSaida,
                n8n: {
                    workflowId: resultadoImportacao.id,
                    ativado: resultadoAtivacao?.sucesso || false
                }
            }
        });
    } catch (erro) {
        console.error('Erro ao gerar e importar workflow:', erro);
        res.status(500).json({
            erro: 'Falha ao gerar e importar workflow',
            mensagem: erro.message || 'Erro desconhecido'
        });
    }
});

// Obter todos os workflows gerados
app.get('/api/workflows', (req, res) => {
    try {
        const arquivos = fs.readdirSync(diretorioSaida);
        const workflows = arquivos.filter(arquivo => arquivo.endsWith('.json')).map(arquivo => {
            const caminhoArquivo = path.join(diretorioSaida, arquivo);
            const stats = fs.statSync(caminhoArquivo);
            return {
                nomeArquivo: arquivo,
                caminho: caminhoArquivo,
                dataCriacao: stats.birthtime
            };
        });
        res.status(200).json({
            sucesso: true,
            quantidade: workflows.length,
            dados: workflows
        });
    } catch (erro) {
        console.error('Erro ao listar workflows:', erro);
        res.status(500).json({
            erro: 'Falha ao listar workflows',
            mensagem: erro.message
        });
    }
});

// Obter um workflow específico
app.get('/api/workflows/:nomeArquivo', (req, res) => {
    try {
        const { nomeArquivo } = req.params;
        const caminhoArquivo = path.join(diretorioSaida, nomeArquivo);
        if (!fs.existsSync(caminhoArquivo)) {
            return res.status(404).json({
                erro: 'Workflow não encontrado',
                mensagem: `Nenhum workflow encontrado com o nome: ${nomeArquivo}`
            });
        }
        const conteudoWorkflow = fs.readFileSync(caminhoArquivo, 'utf8');
        const workflow = JSON.parse(conteudoWorkflow);
        res.status(200).json({
            sucesso: true,
            dados: workflow
        });
    } catch (erro) {
        console.error('Erro ao recuperar workflow:', erro);
        res.status(500).json({
            erro: 'Falha ao recuperar workflow',
            mensagem: erro.message
        });
    }
});

// Inicia o servidor
app.listen(PORTA, () => {
    console.log(`Servidor rodando na porta ${PORTA}`);
    console.log(`Gerador de workflow inicializado com template: ${gerador.caminhoTemplate}`);
    console.log(`Workflows gerados serão salvos em: ${diretorioSaida}`);
    console.log(`Templates disponíveis em: ${diretorioTemplates}`);
    console.log('API Desenvolvida por Victor - https://github.com/Captando');
});

module.exports = app;
