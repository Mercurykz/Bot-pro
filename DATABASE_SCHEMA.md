# 📊 Diagrama de Banco de Dados - Sistema de Histórico de Chamadas

## Relacionamento das Tabelas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TABELAS DO SISTEMA                                 │
└─────────────────────────────────────────────────────────────────────────────┘

                              users
                          ┌─────────┐
                          │   id    │◄──────────┐
                          │username │           │
                          │  role   │           │
                          └─────────┘           │
                              ▲                 │
                              │                 │
                   ┌──────────┬┴──────────┬─────┴──────────┐
                   │          │          │                │
              professor_id │   │          │     professor_id │
                   │          │          │                │
                   │          │          │                │
          ┌────────▼──────┐   │    ┌─────▼─────────────┐  │
          │   classes     │   │    │   call_history    │  │
          ├───────────────┤   │    ├───────────────────┤  │
          │ id (PK)       │   │    │ id (PK)           │  │
          │ professor_id  │───┼────│ class_id (FK)     │  │
          │ subject_id    │   │    │ session_id (FK)   │  │
          │ name          │   │    │ professor_id (FK) │──┘
          │ active        │   │    │ session_name      │
          │ started_at    │   │    │ session_date      │
          │ end_time      │   │    │ session_start_time│
          └───────┬────────┘   │    │ session_end_time  │
                  │            │    │ total_students    │
                  │ class_id   │    │ total_present     │
                  │            │    │ created_at        │
                  │            │    │ updated_at        │
                  │            │    └─────────────────┘
                  │            │
          ┌───────▼──────────┐ │
          │ class_sessions   │ │
          ├──────────────────┤ │
          │ id (PK)          │ │
          │ class_id (FK)    │─┼────┐
          │ start_time       │ │    │
          │ end_time         │ │    │ session_id
          │ active           │ │    │
          └────────┬─────────┘ │    │
                   │           │    │
            session_id         │    │
                   │           │    │
          ┌────────▼────────────┼────▼──────────────────┐
          │                     │                      │
          │          attendance_records                │
          │                     │                      │
          │          ├──────────────────────────────┤  │
          │          │ id (PK)                      │  │
          │          │ session_id (FK)──────────────┼──┘
          │          │ class_id (FK)────────────────┼─────┐
          │          │ professor_id (FK)           │     │
          │          │ student_name                │     │
          │          │ student_id (FK, optional)   │     │
          │          │ attendance_date             │     │
          │          │ attendance_time             │     │
          │          │ created_at                  │     │
          │          │ updated_at                  │     │
          │          └──────────────────────────────┘     │
          │                     ▲                         │
          │                     │                         │
          │            student_id (opcional)             │
          │                     │                         │
          │          ┌──────────┴──────────┐              │
          │          │                     │              │
          │          │  (Vinculado a users│              │
          │          │   quando existe)    │              │
          │          └─────────────────────┘              │
          │                                               │
          └───────────────────────────────────────────────┘

                    attendances (tabela legada)
                      ├─────────────────────────┤
                      │ id (PK)                 │
                      │ class_session_id (FK)   │
                      │ student_id (FK)         │
                      │ student_name            │
                      │ login_at                │
                      └─────────────────────────┘
```

## Fluxo de Dados

```
┌──────────────────────────────────────────────────────────┐
│         ALUNO ENTRA NA SALA (Discord)                    │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  POST /class/:id/join               │
        │  - Registra presença                │
        │  - Armazena em attendances          │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  POST /api/chamadas/historico/      │
        │  registrar-aluno                    │
        │  - Cria attendance_record           │
        │  - Atualiza call_history            │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Banco de Dados                     │
        │  - attendance_records creado        │
        │  - call_history atualizado          │
        └─────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│         PROFESSOR ACESSA /historico-chamadas            │
│         - Vê todas suas chamadas                         │
│         - Filtra por data                               │
│         - Vê detalhes (quem esteve presente)            │
│         - Exporta em Excel                              │
└──────────────────────────────────────────────────────────┘
```

## Índices para Performance

```
┌──────────────────────────────────────────────────────────┐
│                    ÍNDICES CRIADOS                       │
└──────────────────────────────────────────────────────────┘

attendance_records:
├─ attendance_records_session_idx
│  └─ Busca rápida por session_id
├─ attendance_records_professor_idx
│  └─ Busca rápida por professor_id
└─ attendance_records_date_idx
   └─ Busca rápida por attendance_date

call_history:
├─ call_history_class_idx
│  └─ Busca rápida por class_id
├─ call_history_professor_idx
│  └─ Busca rápida por professor_id
└─ call_history_session_date_idx
   └─ Busca rápida por session_date
```

## Permissões de Acesso

```
┌──────────────────────────────────────────────────────────┐
│              CONTROLE DE ACESSO                          │
└──────────────────────────────────────────────────────────┘

PROFESSOR:
├─ GET /api/chamadas/historico
│  └─ Vê apenas SUA chamadas
├─ GET /api/chamadas/historico/:id/detalhes
│  └─ Vê apenas SUAS chamadas
├─ GET /api/chamadas/historico/:id/exportar
│  └─ Exporta apenas SUAS chamadas
├─ POST /api/chamadas/historico/registrar-aluno
│  └─ Registra apenas EM SUAS chamadas
└─ DELETE /api/chamadas/historico/:id
   └─ Deleta apenas SUAS chamadas

ADMIN:
├─ GET /api/chamadas/historico
│  └─ Vê TODAS as chamadas
├─ GET /api/chamadas/historico/:id/detalhes
│  └─ Vê TODAS as chamadas
├─ GET /api/chamadas/historico/:id/exportar
│  └─ Exporta QUALQUER chamada
├─ POST /api/chamadas/historico/registrar-aluno
│  └─ Registra EM QUALQUER chamada
└─ DELETE /api/chamadas/historico/:id
   └─ Deleta QUALQUER chamada

ALUNO:
└─ Sem acesso direto
   (Dados gerados automaticamente quando faz check-in)
```

## Exportação em Excel

```
┌──────────────────────────────────────────────────────────┐
│         ARQUIVO EXPORTADO (Excel/CSV)                    │
└──────────────────────────────────────────────────────────┘

Nome de arquivo:
chamada-[NomeDaSala]-[Data].xlsx

Colunas:
┌─────────┬─────────────────┬─────────────┬───────────┐
│ Nome    │ ID              │ Data        │ Horário   │
├─────────┼─────────────────┼─────────────┼───────────┤
│ João    │ @discord123     │ 01/04/2026  │ 10:05:30  │
│ Maria   │ @discord456     │ 01/04/2026  │ 10:06:15  │
│ Pedro   │ @discord789     │ 01/04/2026  │ 10:07:00  │
└─────────┴─────────────────┴─────────────┴───────────┘
```

---

**Última atualização**: 01/04/2026
**Status**: ✅ Implementado e pronto para deploy
