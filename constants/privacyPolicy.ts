// Privacy policy text (European Portuguese), shared by the app screen
// (app/privacidade.tsx). The site page (marketing/privacidade.html) carries the
// same text. Items marked [A DEFINIR] depend on decisions still to be made.
export const PRIVACY_POLICY_UPDATED = '8 de outubro de 2026';

export const PRIVACY_POLICY: { title: string; body: string[] }[] = [
  {
    title: 'Projeto académico',
    body: [
      'A Wysta é um projeto desenvolvido em âmbito académico. Não é um serviço de saúde real e não substitui uma consulta. Em caso de urgência, liga 112 ou SNS 24 (808 24 24 24).',
      'Responsável pelo tratamento dos dados: [A DEFINIR: nome e contacto].',
      'Para usar a Wysta tens de ter 18 anos ou mais.',
    ],
  },
  {
    title: 'Que dados recolhemos e para quê',
    body: [
      'Conta: o teu email e a palavra-passe, da qual guardamos apenas uma versão protegida (hash), nunca o texto. No modo sem conta não pedimos email.',
      'Perfil, se o preencheres: nome, faixa etária, localidade, doenças e medicação. Servem para a equipa de enfermagem te responder melhor.',
      'Conversas: as tuas mensagens, os ficheiros que anexas e as respostas às perguntas da triagem. Servem para te respondermos e para dar prioridade às situações mais urgentes.',
      'Bem-estar sexual: as respostas ao questionário, para acompanhares a tua evolução.',
      'Notificações: um identificador do teu dispositivo, para te avisarmos de novas respostas. As notificações nunca mostram o conteúdo das mensagens.',
      'Registos técnicos: quando a assistente de IA é usada, guardamos o custo e o número de palavras processadas, sem o texto.',
      'Tratamos estes dados com base no teu consentimento explícito, que dás ao criar a conta ou ao entrar sem conta. [A CONFIRMAR: base legal]',
    ],
  },
  {
    title: 'Quem acede aos teus dados',
    body: [
      'Equipa de enfermagem: só enfermeiros com a cédula profissional verificada pela administração veem as conversas e os dados de saúde.',
      'Administração: gere as contas, a verificação dos enfermeiros e a configuração da assistente. Não tem acesso às conversas nem aos dados de saúde.',
      'Fornecedor de IA: para gerar as respostas da assistente e os resumos para a equipa, partes das tuas conversas são enviadas à OpenAI, nos Estados Unidos, sem o teu nome nem o teu email. [A DEFINIR: fornecedor e região]',
      'A pergunta anónima não fica guardada: quando sais, é apagada. As mensagens passam pelo fornecedor de IA para gerar a resposta.',
    ],
  },
  {
    title: 'Onde ficam alojados',
    body: [
      'A base de dados e os ficheiros ficam na União Europeia (Convex, em servidores na Irlanda). A versão web é servida pela Cloudflare. As notificações no telemóvel passam pelo serviço da Expo e as do navegador pelo serviço do próprio navegador.',
    ],
  },
  {
    title: 'Durante quanto tempo',
    body: [
      'Guardamos os teus dados enquanto tiveres conta. [A DEFINIR: prazo de conservação, por exemplo apagar contas sem atividade ao fim de X meses]',
      'Quando apagas a conta, apagamos o perfil, as conversas, as mensagens, os ficheiros e os registos de bem-estar. O registo de auditoria (quem fez o quê e quando) é mantido sem qualquer ligação a ti.',
    ],
  },
  {
    title: 'Os teus direitos',
    body: [
      'No Perfil, em Gestão de conta, podes exportar uma cópia dos teus dados e apagar a tua conta.',
      'Para corrigir dados, retirar o consentimento ou fazer outro pedido, contacta [A DEFINIR: email de contacto].',
      'Podes também apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD).',
    ],
  },
  {
    title: 'Armazenamento no dispositivo',
    body: [
      'A app guarda no teu dispositivo apenas a sessão e as tuas preferências (por exemplo, o tema). Não usamos cookies de publicidade nem de análise.',
    ],
  },
];
