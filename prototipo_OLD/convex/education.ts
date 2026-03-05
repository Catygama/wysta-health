import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Query: Get all educational articles, optionally filtered by category
export const getEducationalContent = query({
	args: { category: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const { category } = args;
		if (category !== undefined) {
			return await ctx.db
				.query("educationalContent")
				.withIndex("by_category", (q) => q.eq("category", category))
				.order("desc")
				.collect();
		}
		return await ctx.db.query("educationalContent").order("desc").collect();
	},
});

// Query: Get a single article by id
export const getArticle = query({
  args: { articleId: v.id("educationalContent") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.articleId);
  },
});

// Mutation: Seed educational articles for all categories
export const seedEducationalContent = mutation({
  args: {},
  handler: async (ctx) => {
		const articles = [
			{
				title: "Entender o ciclo menstrual",
				category: "ciclo-menstrual",
				tags: ["ciclo", "menstruação", "dor"],
				readingTime: 6,
				content: `O ciclo menstrual pode variar de pessoa para pessoa. É comum sentir algum desconforto, mas dores muito intensas ou sangramento excessivo devem ser avaliados.

Pontos-chave:
- Registar o ciclo ajuda a detetar padrões e alterações.
- Dor leve pode ser controlada com calor local e analgésicos.
- Alterações súbitas podem justificar avaliação clínica.`,
				whenToSeekHelp: `Procure ajuda se:
- A dor for intensa e persistente.
- Existir sangramento muito abundante.
- Surgirem sintomas como febre ou desmaio.`,
				isPublished: true,
			},
			{
				title: "Métodos contracetivos: guia completo",
				category: "contracecao",
				tags: ["contraceção", "planeamento", "saúde sexual"],
				readingTime: 5,
				content: `Existem vários métodos contracetivos disponíveis. A escolha depende do seu estado de saúde, estilo de vida e preferências.

Pontos-chave:
- Alguns métodos também protegem contra IST (ex.: preservativo).
- A contraceção de emergência deve ser usada em situações específicas.
- Aconselhamento profissional ajuda a escolher o método adequado.`,
				whenToSeekHelp: `Procure ajuda se:
- Teve relação sem proteção.
- Teve falha no método contracetivo.
- Tem efeitos secundários preocupantes.`,
				isPublished: true,
			},
			{
				title: "IST: prevenção e rastreio",
				category: "ist",
				tags: ["ist", "prevenção", "rastreio"],
				readingTime: 4,
				content: `As infeções sexualmente transmissíveis podem ser prevenidas e tratadas com diagnóstico atempado.

Pontos-chave:
- O preservativo é a principal forma de prevenção.
- O rastreio regular é importante em relações de risco.
- Alguns sintomas podem ser subtis ou inexistentes.`,
				whenToSeekHelp: `Procure ajuda se:
- Tiver corrimento ou dor ao urinar.
- Surgirem feridas ou lesões.
- Aparecer febre ou dor intensa.`,
				isPublished: true,
			},
			{
				title: "Sinais de alerta na gravidez",
				category: "gravidez",
				tags: ["gravidez", "sintomas", "alerta"],
				readingTime: 3,
				content: `Durante a gravidez, existem sinais que requerem atenção imediata. Identificá-los ajuda a proteger a mãe e o bebé.

Pontos-chave:
- Sangramento e dor intensa não são normais.
- A redução de movimentos do bebé deve ser avaliada.
- Mantenha o acompanhamento regular.`,
				whenToSeekHelp: `Procure ajuda se:
- Tiver sangramento vaginal.
- Sentir dor abdominal intensa.
- Notar redução dos movimentos do bebé.`,
				isPublished: true,
			},
			{
				title: "Bem-estar e saúde geral",
				category: "geral",
				tags: ["bem-estar", "saúde", "prevenção"],
				readingTime: 3,
				content: `Manter hábitos saudáveis melhora o bem-estar físico e emocional.

Pontos-chave:
- Alimentação equilibrada e sono regular.
- Atividade física moderada.
- Gestão de stress e saúde mental.`,
				whenToSeekHelp: `Procure ajuda se:
- Tiver sintomas persistentes.
- Se sentir ansiosa ou em baixo por longos períodos.
- Tiver dúvidas sobre a sua saúde.`,
				isPublished: true,
			},
		];

    for (const article of articles) {
      // Only insert if not already present (by title and category)
      const existing = await ctx.db
        .query("educationalContent")
        .withIndex("by_category", (q) => q.eq("category", article.category))
        .collect();
      if (!existing.some(a => a.title === article.title)) {
        await ctx.db.insert("educationalContent", article);
      }
    }
  },
});
