# 📚 Sistema de Histórico de Chamadas - Mercury Class

## 📋 Resumo do que foi implementado

### 1. **Novas Tabelas no Banco de Dados**

#### `attendance_records`
Armazena registros detalhados de presença dos alunos:
- `id` - Identificador único
- `session_id` - Referência à sessão
- `class_id` - ID da sala de aula
- `professor_id` - ID do professor responsável
- `student_name` - Nome do aluno
- `student_id` - ID do aluno (Discord)
- `attendance_date` - Data da presença
- `attendance_time` - Horário exato da presença
- `created_at` - Data de criação
- `updated_at` - Data de última atualização

#### `call_history`
Armazena o resumo histórico das chamadas:
- `id` - Identificador único
- `class_id` - ID da sala de aula
- `session_id` - ID da sessão
- `professor_id` - ID do professor
- `session_name` - Nome da chamada
- `session_date` - Data da chamada
- `session_start_time` - Horário de início
- `session_end_time` - Horário de fim (opcional)
- `total_students` - Total de alunos
- `total_present` - Total de presentes
- `created_at` - Data de criação
- `updated_at` - Data de atualização

### 2. **Endpoints de API**

#### GET `/api/chamadas/historico`
Lista todo o histórico de chamadas
- **Acesso**: Professor (apenas suas chamadas) ou Admin (todas)
- **Retorno**: JSON com array de chamadas
```json
{
  "id": 1,
  "class_name": "Matemática 101",
  "session_date": "2026-04-01",
  "session_start_time": "2026-04-01T10:00:00Z",
  "total_students": 30,
  "total_present": 28
}
```

#### GET `/api/chamadas/historico/:callId/detalhes`
Obtém detalhes completos de uma chamada com lista de alunos
- **Acesso**: Professor (apenas suas chamadas) ou Admin
- **Retorno**: JSON com chamada e array de registros de presença

#### POST `/api/chamadas/historico/registrar`
Registra uma nova chamada no histórico
- **Acesso**: Professor ou Admin
- **Parâmetros**:
  - `session_id` - ID da sessão
  - `class_id` - ID da sala
  - `session_name` - Nome da chamada
  - `session_date` - Data
  - `total_students` - Total de alunos (opcional)
  - `total_present` - Total de presentes (opcional)

#### POST `/api/chamadas/historico/:callId/registrar-aluno`
Registra presença de um aluno no histórico
- **Acesso**: Professor (suas chamadas) ou Admin
- **Parâmetros**:
  - `student_name` - Nome do aluno
  - `student_id` - ID do aluno (opcional)
  - `attendance_date` - Data da presença

#### GET `/api/chamadas/historico/:callId/exportar`
Exporta uma chamada em Excel ou CSV
- **Acesso**: Professor (suas chamadas) ou Admin
- **Query Params**:
  - `format` - "xlsx" (padrão) ou "csv"
- **Retorno**: Arquivo para download com:
  - Nome do aluno
  - ID do aluno
  - Data da presença
  - Horário da presença

#### DELETE `/api/chamadas/historico/:callId`
Deleta um histórico de chamada
- **Acesso**: Professor (suas chamadas) ou Admin
- **Retorno**: `{ success: true }`

### 3. **Interface de Usuário - `/historico-chamadas`**

Nova página acessível para Professores e Admins com:

#### Features:
- 📊 **Tabela de chamadas** com:
  - Nome da sala de aula
  - Data da chamada
  - Horário de início
  - Quantidade de presentes
  - Ações (Ver, Exportar, Excluir)

- 🔍 **Filtros**:
  - Por data
  - Botão para limpar filtros

- 👁️ **Modal de detalhes**:
  - Informações completas da chamada
  - Lista com nome e horário de cada aluno presente

- 📥 **Exportação**:
  - Download automático em Excel
  - Formatação profissional com colunas: Nome, ID, Data, Horário
  - Redimensionamento automático de colunas

- 🗑️ **Gerenciamento**:
  - Excluir chamadas antigas com confirmação

### 4. **Índices de Banco de Dados**

Para otimizar performance:
- `attendance_records_session_idx` - Busca rápida por sessão
- `attendance_records_professor_idx` - Busca por professor
- `attendance_records_date_idx` - Busca por data
- `call_history_class_idx` - Busca por sala
- `call_history_professor_idx` - Busca por professor
- `call_history_session_date_idx` - Busca por data

## 🔧 Como Usar

### Para Professores:
1. Clique em "📚 Histórico" no menu lateral
2. Visualize todas as suas chamadas passadas
3. Use filtros para encontrar chamadas específicas
4. Clique em "📋 Ver" para ver detalhes e lista de alunos
5. Clique em "📥 Excel" para baixar a lista em Excel
6. Clique em "🗑️ Excluir" para remover histórico (com confirmação)

### Para Admins:
1. Tem acesso ao histórico completo de todas as chamadas
2. Pode visualizar e exportar chamadas de qualquer professor
3. Pode gerenciar e deletar históricos de qualquer usuário

## 📊 Estrutura de Dados

As tabelas foram desenhadas para garantir:
- ✅ **Integridade referencial** - Deletar uma sala deleta automaticamente seus registros
- ✅ **Performance** - Índices estratégicos para buscas rápidas
- ✅ **Auditoria** - Campos `created_at` e `updated_at` para rastreabilidade
- ✅ **Flexibilidade** - Suporta tanto dados novos quanto legados

## 🚀 Integração com Sistema Existente

O sistema se integra perfeitamente com:
- Sistema existente de chamadas (`/chamadas`)
- Tabelas `class_sessions` e `attendances`
- Sistema de autenticação (OAuth Discord)
- Roles de usuário (admin, professor, aluno)

## 📝 Fluxo de Dados

```
Aluno faz check-in na aula
       ↓
attendance_records criado
       ↓
call_history é atualizado
       ↓
Professor acessa /historico-chamadas
       ↓
Visualiza e exporta em Excel
```

## 🔐 Segurança

- ✅ Professores veem apenas suas próprias chamadas
- ✅ Admins veem tudo
- ✅ Autenticação obrigatória
- ✅ Permissões verificadas em cada endpoint
- ✅ Soft deletes com confirmação do usuário

## 📦 Commit

Implementado em: `7bf4d87`
- +321 linhas adicionadas
- 3 novas tabelas
- 6 novos endpoints de API
- 1 nova página HTML/JS

---

**Status**: ✅ Pronto para usar após redeploy do Server no Railway
