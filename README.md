# Kevin Bot API 🤖

API REST para o sistema Kevin Bot, fornecendo endpoints para gerenciamento de chatbots, multi-tenancy e analytics.

## 🎯 Objetivos

- Criar uma API que permita gerenciar múltiplos chatbots para diferentes clientes
- Fornecer sistema de multi-tenancy para isolamento de dados
- Implementar sistema de cobrança e planos
- Facilitar a integração do chatbot em diferentes plataformas

## 🏗️ Estrutura do Projeto

```
src/
├── controllers/     # Controladores da API
├── services/       # Lógica de negócios
├── models/         # Tipos e interfaces
├── middleware/     # Middlewares (auth, rate limit)
├── routes/         # Rotas da API
├── config/         # Configurações
└── utils/          # Utilitários
```

## 🚀 Endpoints Principais

### Tenants

- `POST /api/v1/tenants` - Criar novo tenant
- `GET /api/v1/tenants/:id` - Obter dados do tenant
- `PUT /api/v1/tenants/:id` - Atualizar configurações

### Auth

- `POST /api/v1/auth/register` - Registrar novo usuário
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/api-keys` - Gerar API key

### Chat

- `POST /api/v1/chat/messages` - Enviar mensagem
- `GET /api/v1/chat/history` - Obter histórico
- `PUT /api/v1/chat/settings` - Configurar chatbot

### Analytics

- `GET /api/v1/analytics/metrics` - Métricas gerais
- `GET /api/v1/analytics/reports` - Relatórios detalhados

## 💰 Planos e Limites

### Starter ($49/mês)

- 1.000 mensagens/mês
- Chat widget básico
- Métricas essenciais
- 100 usuários ativos

### Professional ($149/mês)

- 5.000 mensagens/mês
- Chat widget personalizado
- Analytics completo
- 500 usuários ativos
- Customização avançada

## 🔧 Tecnologias

- Node.js + Express
- TypeScript
- Prisma (ORM)
- Supabase (Database)
- Stripe (Pagamentos)
- Jest (Testes)

## 📦 Instalação

1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/kevinbot-api.git
cd kevinbot-api
```

2. Instale as dependências

```bash
npm install
```

3. Configure as variáveis de ambiente

```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Execute as migrações do banco

```bash
npx prisma migrate dev
```

5. Inicie o servidor

```bash
npm run dev
```

## 🔄 Integração com Frontend

1. Instale o SDK

```bash
npm install @kevinbot/sdk
```

2. Inicialize o widget

```javascript
import { KevinBot } from "@kevinbot/sdk";

const bot = new KevinBot({
  apiKey: "sua_api_key",
  theme: "light",
});
```

## 📝 TODO

### Fase 1 (Semanas 1-2)

- [ ] Estrutura básica da API
- [ ] Sistema de autenticação
- [ ] Multi-tenancy no Supabase
- [ ] Endpoints de chat

### Fase 2 (Semanas 3-4)

- [ ] SDK JavaScript
- [ ] Sistema de cobrança
- [ ] Widget customizável
- [ ] Analytics básico

### Fase 3 (Semanas 5-6)

- [ ] Documentação da API
- [ ] Painel do cliente
- [ ] Testes automatizados
- [ ] Deploy inicial

## 📚 Documentação

- [Documentação da API](docs/api.md)
- [Guia de Integração](docs/integration.md)
- [Exemplos de Uso](docs/examples.md)

## 🤝 Contribuindo

1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 Suporte

- Email: suporte@kevinbot.ai
- Discord: [discord.gg/kevinbot](https://discord.gg/kevinbot)
- Documentação: [docs.kevinbot.ai](https://docs.kevinbot.ai)
