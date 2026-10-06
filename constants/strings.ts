export const strings = {
  app: { name: 'Wysta' },
  auth: {
    login: 'Entrar',
    register: 'Criar conta',
    logout: 'Sair',
    email: 'Email',
    password: 'Palavra-passe',
    confirmPassword: 'Confirmar palavra-passe',
    noAccount: 'Ainda não tens conta?',
    hasAccount: 'Já tens conta?',
  },
  errors: {
    generic: 'Ocorreu um erro. Tenta novamente.',
    required: 'Campo obrigatório',
    invalidEmail: 'Email inválido',
    passwordMismatch: 'As palavras-passe não coincidem',
    notAuthenticated: 'Sessão expirada. Faz login novamente.',
  },
  // Shown on auth screens, profile and the landing: Wysta is an academic
  // prototype, not a real clinical service.
  academic: {
    title: 'Projeto académico',
    message:
      'A Wysta é um protótipo desenvolvido no âmbito de um projeto académico. Não é um serviço de saúde real e as respostas não substituem uma consulta.',
    // Rendered with tappable numbers (tel: links) by AcademicNotice.
    emergencyLead: 'Em caso de urgência, liga',
    emergencyOr: 'ou',
  },
  urgency: {
    title: 'Situação urgente',
    message:
      'Com base nas tuas respostas, esta situação pode requerer atenção imediata.',
    snsCta: 'Ligar SNS 24 (808 24 24 24)',
    emergencyCta: 'Ligar 112',
    dismiss: 'Continuar mesmo assim',
  },
};
