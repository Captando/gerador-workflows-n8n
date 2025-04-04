# Gerador de Workflows n8n

API para gerar e importar workflows para n8n baseados em templates personalizados.

## Descrição

Esta API simplifica a criação e importação de workflows para o n8n através de templates. Ela permite:

- Upload e gerenciamento de templates de workflow
- Geração de novos workflows baseados em templates
- Importação automática de workflows para o n8n
- Alteração simplificada da URL do node webhook "Entrada"

## Funcionalidades

- Gerenciamento de templates (upload, listagem, seleção)
- Geração de workflows customizados
- Importação direta para o n8n via API
- Ativação automática de workflows
- Armazenamento local de workflows gerados

## Requisitos

- Node.js >= 12.0.0
- Instância n8n com API key configurada

## Instalação

```bash
# Clonar o repositório
git clone https://github.com/Captando/gerador-workflows-n8n.git
cd gerador-workflows-n8n

# Instalar dependências
npm install

# Configurar a conexão com o n8n
# Edite o arquivo config.json com suas credenciais
```

## Configuração

Crie um arquivo `config.json` com suas credenciais do n8n:

```json
{
  "urlN8n": "https://seu-servidor-n8n.com",
  "chaveApiN8n": "sua-chave-api-n8n"
}
```

## Uso

```bash
# Iniciar o servidor
npm start

# Para desenvolvimento com reinício automático
npm run dev
```

O servidor estará disponível em `http://localhost:5656` por padrão.

## Endpoints da API

### Templates

- `POST /api/templates/upload` - Upload de novo template
- `GET /api/templates` - Listar templates disponíveis
- `POST /api/templates/selecionar/:nomeArquivo` - Selecionar template ativo

### Workflows

- `POST /api/workflows` - Criar e salvar workflow
- `POST /api/workflows/importar` - Criar, salvar e importar workflow para o n8n
- `GET /api/workflows` - Listar todos os workflows gerados
- `GET /api/workflows/:nomeArquivo` - Obter workflow específico

## Licença

MIT

## Autor

Victor Silva - [GitHub](https://github.com/Captando)
