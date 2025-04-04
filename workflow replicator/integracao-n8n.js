/**
 * @file integracao-n8n.js
 * @author Victor Silva - https://github.com/Captando
 * @description Módulo para interação com a API do n8n
 */

const axios = require('axios');
const fs = require('fs');

/**
 * Importa um workflow para o n8n
 * @param {Object} workflow - Objeto workflow a ser importado
 * @param {string} urlN8n - URL base da instância n8n (ex: 'https://seu-servidor-n8n.com')
 * @param {string} chaveApiN8n - Chave API para autenticação
 * @returns {Promise<Object>} - ID do workflow importado e status
 */
async function importarWorkflow(workflow, urlN8n, chaveApiN8n) {
    try {
        console.log(`Iniciando importação para ${urlN8n}`);

        // Criar cliente HTTP
        const cliente = axios.create({
            baseURL: `${urlN8n}/api/v1`,
            headers: {
                'X-N8N-API-KEY': chaveApiN8n,
                'Content-Type': 'application/json'
            }
        });

        // Criar uma versão completa do workflow preservando todas as propriedades dos nós
        // incluindo credenciais
        const workflowCompleto = {
            name: workflow.name,
            nodes: workflow.nodes.map(node => {
                // Preserva todas as propriedades originais do nó
                return {
                    ...node,
                    // Garante que typeVersion esteja definido
                    typeVersion: node.typeVersion || 1
                };
            }),
            connections: workflow.connections || {},
            settings: workflow.settings || {}
        };

        // Para depuração, vamos registrar a estrutura do workflow
        console.log('Estrutura do workflow a ser enviado:', JSON.stringify(workflowCompleto, null, 2));

        // Remover explicitamente a propriedade 'active' caso exista
        if (workflowCompleto.active !== undefined) {
            delete workflowCompleto.active;
        }

        console.log(`Enviando workflow ${workflow.name} para importação...`);

        // Importar o workflow
        const resposta = await cliente.post('/workflows', workflowCompleto);

        const idWorkflow = resposta.data.id;
        console.log(`Workflow importado com sucesso! ID: ${idWorkflow}`);

        return {
            sucesso: true,
            id: idWorkflow,
            mensagem: `Workflow "${workflow.name}" importado com sucesso!`
        };
    } catch (erro) {
        console.error('Erro durante a importação do workflow:', erro.response?.data?.message || erro.message);
        console.error('Detalhes completos do erro:', JSON.stringify(erro.response?.data || {}, null, 2));

        // Retorno detalhado para ajudar no diagnóstico
        return {
            sucesso: false,
            erro: erro.response?.data?.message || erro.message,
            detalhes: erro.response?.data || {}
        };
    }
}

/**
 * Ativa um workflow no n8n
 * @param {string} idWorkflow - ID do workflow a ser ativado
 * @param {string} urlN8n - URL base da instância n8n
 * @param {string} chaveApiN8n - Chave API para autenticação
 * @returns {Promise<Object>} - Resultado da ativação
 */
async function ativarWorkflow(idWorkflow, urlN8n, chaveApiN8n) {
    try {
        console.log(`Ativando workflow ${idWorkflow}...`);

        const cliente = axios.create({
            baseURL: `${urlN8n}/api/v1`,
            headers: {
                'X-N8N-API-KEY': chaveApiN8n,
                'Content-Type': 'application/json'
            }
        });

        const resposta = await cliente.post(`/workflows/${idWorkflow}/activate`);

        console.log(`Workflow ${idWorkflow} ativado com sucesso!`);
        return {
            sucesso: true,
            mensagem: `Workflow ativado com sucesso!`
        };
    } catch (erro) {
        console.error(`Erro ao ativar workflow:`, erro.response?.data?.message || erro.message);
        return {
            sucesso: false,
            erro: erro.response?.data?.message || erro.message
        };
    }
}

module.exports = { importarWorkflow, ativarWorkflow };