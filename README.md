# NutriMara

Consultório digital da nutricionista Marakesia Nascimento (CRN 11-6356). Organiza pacientes, agenda, planos alimentares, evolução e avaliação por fotos.

## Código

- `app/` e `components/`: interface e rotas da aplicação.
- `db/` e `drizzle/`: esquema e migrações do banco.
- `lib/`: cálculos e tratamento dos arquivos de fotos.
- `public/marakesia-logo.png`: identidade visual utilizada no Site.

## Executar localmente

Requer Node.js 22.13 ou superior.

```bash
npm ci
npm run dev
```

A publicação usa Sites, com D1 (`DB`) para os registros e R2 (`BUCKET`) para as fotos, conforme `.openai/hosting.json`. A autenticação e os serviços de produção dependem do ambiente do Site.

Este repositório guarda o código e os recursos visuais. Registros de pacientes e fotos não estão incluídos.
