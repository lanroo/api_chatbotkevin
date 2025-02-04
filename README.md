# Kevin Bot API 🤖

A multi-tenant chatbot API powered by Gemini AI and OpenRouter, with built-in analytics and usage tracking.

## Features

- 🤖 Advanced AI chat capabilities using Gemini AI (with OpenRouter fallback)
- 👥 Multi-tenant architecture for managing multiple clients
- 📊 Built-in analytics and usage tracking
- 💰 Usage-based billing system
- 🔒 Secure authentication and API key management
- ⚡ Rate limiting and quota management

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL (via Supabase)
- **AI Providers**:
  - Gemini AI (Primary)
  - OpenRouter (Fallback)
- **Authentication**: JWT + API Keys
- **Documentation**: OpenAPI/Swagger

## Prerequisites

- Node.js 18+
- PostgreSQL
- npm or yarn

## Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/kevinbot-api.git
   cd kevinbot-api
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment variables file:

   ```bash
   cp .env.example .env
   ```

4. Update the environment variables in `.env` with your values:

   - Database connection
   - AI provider API keys
   - JWT secret
   - Stripe keys
   - Other configuration

5. Initialize the database:

   ```bash
   npx prisma migrate dev
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Chat

- `POST /api/v1/chat/messages` - Send a message to the chatbot
- `GET /api/v1/chat/history` - Get chat history
- `DELETE /api/v1/chat/history` - Clear chat history

### Tenants

- `POST /api/v1/tenants` - Create a new tenant
- `GET /api/v1/tenants/:id` - Get tenant details
- `PUT /api/v1/tenants/:id` - Update tenant
- `DELETE /api/v1/tenants/:id` - Delete tenant

### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/api-keys` - Generate API key
- `DELETE /api/v1/auth/api-keys/:id` - Revoke API key

### Analytics

- `GET /api/v1/analytics/metrics` - Get usage metrics
- `GET /api/v1/analytics/usage` - Get detailed usage stats
- `GET /api/v1/analytics/reports` - Get analytics reports

## Authentication

The API supports two authentication methods:

1. **JWT Tokens**: For dashboard/admin access

   ```
   Authorization: Bearer <token>
   ```

2. **API Keys**: For client applications
   ```
   X-API-Key: <api_key>
   ```

## Rate Limiting

- Rate limits are applied per tenant based on their plan:
  - Starter: 1,000 messages/month
  - Pro: 10,000 messages/month
  - Enterprise: 100,000 messages/month

## Development

### Running Tests

```bash
npm run test
```

### Linting

```bash
npm run lint
```

### Building for Production

```bash
npm run build
```

## Deployment

1. Build the application:

   ```bash
   npm run build
   ```

2. Set production environment variables

3. Run database migrations:

   ```bash
   npx prisma migrate deploy
   ```

4. Start the server:
   ```bash
   npm start
   ```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@kevinbot.com or create an issue in the repository.
