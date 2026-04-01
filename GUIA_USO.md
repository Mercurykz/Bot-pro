# 🎯 Guia de Uso - Sistema de Histórico de Chamadas

## 📱 Como Acessar

### Para Professores:
1. Faça login no **Presença Plus**
2. No menu lateral, clique em **📚 Histórico**
3. Você verá todas as suas chamadas antigas com:
   - Nome da sala de aula
   - Data e horário
   - Quantidade de alunos presentes

### Para Admins:
1. Acesse o **Painel Admin** (⚙️)
2. Clique em **📚 Histórico de Chamadas**
3. Você terá acesso a TODAS as chamadas do sistema

## 🔍 Filtrando Chamadas

### Por Data:
1. Clique no campo "📅 Data"
2. Selecione a data desejada
3. Clique em "🔍 Filtrar"
4. Limpe com o botão "✕ Limpar"

### Resultado:
A tabela mostrará apenas chamadas daquela data

## 👁️ Visualizando Detalhes

1. Clique no botão **📋 Ver** de qualquer chamada
2. Um popup abrirá mostrando:
   - ℹ️ Informações da chamada (sala, data, horário)
   - 📊 Total de presentes vs. total de alunos
   - 👥 **Lista completa de alunos presentes** com:
     - Nome do aluno
     - Horário exato que fez check-in

## 📥 Exportando em Excel

### Passo 1: Localize a Chamada
- Use os filtros se necessário
- Encontre a chamada que deseja exportar

### Passo 2: Clique em Exportar
- Clique no botão **📥 Excel** da chamada
- O arquivo começará a ser baixado automaticamente

### Passo 3: Arquivo Recebido
O arquivo Excel conterá:
- **Nome do arquivo**: `chamada-[NomeDaSala]-[Data].xlsx`
- **Colunas**:
  - 👤 Nome - Nome do aluno
  - 🔗 ID - ID no Discord (se disponível)
  - 📅 Data - Data da presença (01/04/2026)
  - ⏰ Horário - Horário exato (10:05:30)

### Passo 4: Usar o Excel
O arquivo está pronto para:
- ✅ Imprimir
- ✅ Compartilhar com coordenação
- ✅ Importar em outro sistema
- ✅ Fazer análises de frequência

## 🗑️ Deletando Histórico

⚠️ **Esta ação é irreversível!**

### Se tiver certeza:
1. Clique em **🗑️ Excluir** na chamada
2. Confirme no popup
3. A chamada será removida do sistema
4. Todos os registros de presença também serão deletados

## 📊 Exemplos de Uso

### Exemplo 1: Professor precisa comprovar presença
1. Acessa `/historico-chamadas`
2. Localiza a data da aula
3. Clica em "📋 Ver"
4. Imprime a lista de alunos
5. Assina e entrega para coordenação

### Exemplo 2: Análise de frequência
1. Seleciona data de início
2. Exporta todas as chamadas
3. Abre em Excel
4. Usa fórmulas para calcular frequência por aluno
5. Cria gráficos de attendance

### Exemplo 3: Admin auditando sistema
1. Acessa panel admin
2. Visualiza histórico de TODAS as salas
3. Pode conferir se presença foi registrada corretamente
4. Pode deletar registros incorretos se necessário

## 🔒 Permissões

| Ação | Professor | Admin |
|------|-----------|-------|
| Ver suas chamadas | ✅ | ✅ |
| Ver todas as chamadas | ❌ | ✅ |
| Exportar suas chamadas | ✅ | ✅ |
| Exportar qualquer chamada | ❌ | ✅ |
| Registrar aluno em suas chamadas | ✅ | ✅ |
| Registrar aluno em qualquer chamada | ❌ | ✅ |
| Deletar suas chamadas | ✅ | ✅ |
| Deletar qualquer chamada | ❌ | ✅ |

## 💡 Dicas Úteis

### 🚀 Atalhos
- Use a barra de filtro para encontrar rápido
- Clique "Limpar" para ver todas as chamadas novamente

### 📋 Boas Práticas
- Exporte regularmente as chamadas como backup
- Mantenha um arquivo local das presenças importantes
- Use o modal "Ver" antes de exportar para confirmar dados

### 🎨 Interface
- A tabela é responsiva (funciona em celular)
- Os botões mudam de cor ao passar o mouse
- Modal permite ampliar o tamanho da letra

## ❓ Perguntas Frequentes

### P: Posso recuperar uma chamada deletada?
R: Não, a exclusão é permanente. Tenha cuidado ao confirmar!

### P: Por que não vejo minhas chamadas antigas?
R: Verifique se:
- Está logado como professor
- A data está dentro do intervalo correto
- Clique "Limpar" para remover filtros

### P: O Excel está vazio?
R: Isso significa que nenhum aluno fez check-in naquela chamada.

### P: Posso exportar em CSV?
R: Atualmente o sistema exporta em Excel (.xlsx). Para CSV, abra o Excel e salve como CSV.

### P: Quantas chamadas posso armazenar?
R: Sem limite! O banco de dados foi otimizado para lidar com muitos registros.

### P: Os horários estão corretos?
R: Os horários são registrados no timezone do servidor (UTC). Pode haver diferença com o seu timezone local.

## 🔧 Troubleshooting

### Problema: Página fica branca/carregando
**Solução**: 
- Aguarde alguns segundos
- Atualize a página (F5)
- Limpe cache do navegador

### Problema: Botão de Exportar não funciona
**Solução**:
- Clique novamente
- Aguarde a janela de download aparecer
- Verifique se pop-ups estão bloqueados

### Problema: Não consigo deletar uma chamada
**Solução**:
- Verifique se é admin ou dona da chamada
- Tente novamente
- Contate o suporte do sistema

### Problema: Dados não atualizam
**Solução**:
- Atualize a página
- Limpe cache (Ctrl + Shift + Delete)
- Faça login novamente

## 📞 Suporte

Se encontrar algum problema:
1. Tente os passos de Troubleshooting acima
2. Tirar screenshot do erro
3. Contactar o administrador do sistema
4. Reportar em GitHub Issues

---

**Versão**: 1.0
**Data**: 01/04/2026
**Status**: ✅ Disponível para uso
