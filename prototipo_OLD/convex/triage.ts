import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getTriageQuestions = query({
  args: {
    category: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("triageQuestions")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .unique();
  },
});

export const seedTriageQuestions = mutation({
  args: {},
  handler: async (ctx) => {
    // Seed triage questions for multiple categories
		const categories = [
			{
				category: "ciclo-menstrual",
				questions: [
					{
						id: "dor-intensidade",
						question: "Qual a intensidade da dor (1-10)?",
						type: "scale",
						options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
						required: true,
					},
					{
						id: "sangramento-intenso",
						question: "Tem sangramento muito intenso?",
						type: "yes-no",
						isRedFlag: true,
						required: true,
					},
					{
						id: "duracao",
						question: "Há quantos dias sente estes sintomas?",
						type: "multiple-choice",
						options: ["Menos de 24h", "1-3 dias", "4-7 dias", "Mais de 1 semana"],
						required: true,
					},
					{
						id: "febre",
						question: "Tem febre (>=38°C)?",
						type: "yes-no",
						isRedFlag: true,
						required: true,
					},
				],
				riskAssessment: {
					lowRisk: {
						criteria: ["!sangramento-intenso", "!febre"],
						guidance: "Sintomas ligeiros podem ser acompanhados com medidas de conforto.",
					},
					mediumRisk: {
						criteria: ["dor-intensidade >= 6", "duracao == '4-7 dias'"],
						guidance: "Se a dor persistir, considere avaliação clínica.",
					},
					highRisk: {
						criteria: ["sangramento-intenso", "febre", "dor-intensidade >= 9"],
						guidance: "Sintomas graves exigem atenção imediata. Contacte 112 ou SNS24.",
					},
				},
			},
			{
				category: "contracecao",
				questions: [
					{
						id: "metodo-atual",
						question: "Está a utilizar algum método contracetivo?",
						type: "multiple-choice",
						options: ["Nenhum", "Pílula", "DIU", "Implante", "Preservativo", "Outro"],
						required: true,
					},
					{
						id: "preocupacao",
						question: "Qual a sua principal dúvida?",
						type: "multiple-choice",
						options: [
							"Efeitos secundários",
							"Eficácia do método",
							"Iniciar novo método",
							"Parar método atual",
							"Contraceção de emergência",
						],
						required: true,
					},
					{
						id: "relacao-sem-protecao",
						question: "Teve relação sem proteção nos últimos dias?",
						type: "yes-no",
						isRedFlag: true,
						required: true,
					},
				],
				riskAssessment: {
					lowRisk: {
						criteria: ["preocupacao != 'Contraceção de emergência'", "!relacao-sem-protecao"],
						guidance: "Informação geral sobre métodos contracetivos.",
					},
					mediumRisk: {
						criteria: ["preocupacao == 'Efeitos secundários'"],
						guidance: "Pode ser necessário ajustar o método.",
					},
					highRisk: {
						criteria: ["preocupacao == 'Contraceção de emergência'", "relacao-sem-protecao"],
						guidance: "Situação urgente. Avalie contraceção de emergência.",
					},
				},
			},
			{
				category: "ist",
				questions: [
					{
						id: "corrimento",
						question: "Tem corrimento diferente do habitual?",
						type: "yes-no",
						required: true,
					},
					{
						id: "feridas",
						question: "Tem feridas, verrugas ou lesões visíveis?",
						type: "yes-no",
						isRedFlag: true,
						required: true,
					},
					{
						id: "dor-urinar",
						question: "Sente dor ou ardor ao urinar?",
						type: "yes-no",
						required: true,
					},
					{
						id: "febre",
						question: "Tem febre (>=38°C)?",
						type: "yes-no",
						isRedFlag: true,
						required: true,
					},
				],
				riskAssessment: {
					lowRisk: {
						criteria: ["!feridas", "!febre"],
						guidance: "Sintomas ligeiros podem ser acompanhados, mas recomenda-se rastreio.",
					},
					mediumRisk: {
						criteria: ["corrimento", "dor-urinar"],
						guidance: "Pode ser necessário avaliação clínica e testes.",
					},
					highRisk: {
						criteria: ["feridas", "febre"],
						guidance: "Sintomas relevantes. Procure avaliação médica.",
					},
				},
			},
			{
				category: "gravidez",
				questions: [
					{
						id: "semanas",
						question: "Quantas semanas de gravidez?",
						type: "multiple-choice",
						options: ["Não tenho a certeza", "Menos de 12 semanas", "12-28 semanas", "Mais de 28 semanas"],
						required: true,
					},
					{
						id: "sangramento",
						question: "Tem sangramento vaginal?",
						type: "yes-no",
						isRedFlag: true,
						required: true,
					},
					{
						id: "dor-abdominal",
						question: "Sente dor abdominal intensa?",
						type: "yes-no",
						isRedFlag: true,
						required: true,
					},
					{
						id: "movimentos",
						question: "Notou redução dos movimentos do bebé?",
						type: "yes-no",
						isRedFlag: true,
						required: false,
					},
				],
				riskAssessment: {
					lowRisk: {
						criteria: ["!sangramento", "!dor-abdominal", "!movimentos"],
						guidance: "Sem sinais de urgência. Continue o acompanhamento.",
					},
					mediumRisk: {
						criteria: ["semanas == 'Menos de 12 semanas'"],
						guidance: "Monitorize sintomas e acompanhe com o profissional.",
					},
					highRisk: {
						criteria: ["sangramento", "dor-abdominal", "movimentos"],
						guidance: "Sintomas graves. Contacte 112 ou SNS24.",
					},
				},
			},
			{
				category: "geral",
				questions: [
					{
						id: "motivo",
						question: "Qual o motivo principal do contacto?",
						type: "multiple-choice",
						options: ["Sintomas gerais", "Dúvidas de saúde", "Seguimento", "Outro"],
						required: true,
					},
					{
						id: "sintomas-graves",
						question: "Tem sintomas graves ou súbitos?",
						type: "yes-no",
						isRedFlag: true,
						required: true,
					},
					{
						id: "duracao",
						question: "Há quanto tempo sente estes sintomas?",
						type: "multiple-choice",
						options: ["Menos de 24h", "1-3 dias", "4-7 dias", "Mais de 1 semana"],
						required: true,
					},
				],
				riskAssessment: {
					lowRisk: {
						criteria: ["!sintomas-graves"],
						guidance: "Sintomas ligeiros podem ser acompanhados com orientação.",
					},
					mediumRisk: {
						criteria: ["duracao == 'Mais de 1 semana'"],
						guidance: "Pode ser necessária avaliação adicional.",
					},
					highRisk: {
						criteria: ["sintomas-graves"],
						guidance: "Sintomas graves exigem atenção imediata. Contacte 112 ou SNS24.",
					},
				},
			},
		];

    for (const categoryData of categories) {
      const existing = await ctx.db
        .query("triageQuestions")
        .withIndex("by_category", (q) => q.eq("category", categoryData.category))
        .unique();

      if (!existing) {
        await ctx.db.insert("triageQuestions", categoryData);
      }
    }
  },
});
