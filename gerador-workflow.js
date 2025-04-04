/**
 * @file gerador-workflow.js
 * @author Victor Silva - https://github.com/Captando
 * @description Classe para geração de workflows n8n a partir de templates
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class GeradorWorkflow {
    /**
     * Inicializa o gerador de workflows
     * @param {string} caminhoTemplate - Caminho para o arquivo de template
     */
    constructor(caminhoTemplate) {
        this.caminhoTemplate = caminhoTemplate;
        this.template = this.carregarTemplate(caminhoTemplate);

        // Verificar se o template possui a propriedade settings
        // Se não tiver, adiciona para evitar problemas com a API do n8n
        if (!this.template.settings) {
            console.log('Adicionando propriedade settings ao template carregado');
            this.template.settings = {};
        }
    }

    /**
     * Carrega o template do arquivo
     * @param {string} caminhoArquivo - Caminho para o arquivo de template
     * @returns {Object} Template carregado
     */
    carregarTemplate(caminhoArquivo) {
        try {
            const conteudoTemplate = fs.readFileSync(caminhoArquivo, 'utf8');
            return JSON.parse(conteudoTemplate);
        } catch (erro) {
            throw new Error(`Erro ao carregar template: ${erro.message}`);
        }
    }

    /**
     * Gera um ID único para nós do workflow
     * @returns {string} ID único
     */
    gerarIdUnico() {
        // Use UUID v4 para gerar IDs únicos
        return crypto.randomUUID ? crypto.randomUUID() :
            `n${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Cria um workflow baseado no template
     * @param {string} nomeWorkflow - Nome do workflow
     * @param {string} caminhoWebhook - Caminho para o webhook
     * @returns {Object} Workflow gerado
     */
    criarWorkflow(nomeWorkflow, caminhoWebhook) {
        try {
            // Clona o template para não modificar o original
            const workflow = JSON.parse(JSON.stringify(this.template));

            // Atualiza o nome do workflow
            workflow.name = nomeWorkflow;

            // IMPORTANTE: Garante que a propriedade settings existe
            // A API do n8n requer esta propriedade
            workflow.settings = {};

            // Processa os nós do workflow
            workflow.nodes = workflow.nodes.map(node => {
                // Gera um ID único para cada nó
                node.id = this.gerarIdUnico();

                // Atualiza o caminho do webhook se o nó for do tipo webhook
                if (node.type === 'n8n-nodes-base.webhook') {
                    node.parameters = node.parameters || {};
                    node.parameters.path = caminhoWebhook;
                }

                // Certifica-se de que typeVersion seja definido
                if (!node.typeVersion) {
                    node.typeVersion = 1;
                }

                return node;
            });

            // Garante que connections existe
            workflow.connections = workflow.connections || {};

            console.log(`Workflow "${nomeWorkflow}" criado com sucesso, com caminho webhook "${caminhoWebhook}"`);
            console.log('Propriedades do workflow:', Object.keys(workflow));

            return workflow;
        } catch (erro) {
            throw new Error(`Erro ao criar workflow: ${erro.message}`);
        }
    }

    /**
     * Salva o workflow em um arquivo
     * @param {Object} workflow - Workflow a ser salvo
     * @param {string} caminhoArquivo - Caminho onde o arquivo será salvo
     */
    salvarWorkflow(workflow, caminhoArquivo) {
        try {
            const conteudoJson = JSON.stringify(workflow, null, 2);
            fs.writeFileSync(caminhoArquivo, conteudoJson);
            console.log(`Workflow salvo em: ${caminhoArquivo}`);
        } catch (erro) {
            throw new Error(`Erro ao salvar workflow: ${erro.message}`);
        }
    }
}

module.exports = GeradorWorkflow;