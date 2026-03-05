import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface EducationLibraryProps {
	onStartTriage?: (category: string) => void;
}

export function EducationLibrary({ onStartTriage }: EducationLibraryProps) {
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [selectedArticle, setSelectedArticle] = useState<string | null>(null);

	const articles = useQuery(api.education.getEducationalContent, {
		category: selectedCategory || undefined,
	});
	const article = useQuery(
		api.education.getArticle,
		selectedArticle ? { articleId: selectedArticle as any } : "skip"
	);

	const categories = [
		{ id: "contracecao", title: "Contraceção", icon: "💊" },
		{ id: "gravidez", title: "Gravidez", icon: "🤱" },
		{ id: "ist", title: "IST", icon: "🧪" },
		{ id: "ciclo-menstrual", title: "Ciclo Menstrual", icon: "🩸" },
		{ id: "geral", title: "Saúde Geral", icon: "💬" },
	];

	const categoryLabel = (categoryId: string) => {
		const map: Record<string, string> = {
			"contracecao": "Contraceção",
			"gravidez": "Gravidez",
			"ist": "IST",
			"ciclo-menstrual": "Ciclo Menstrual",
			"geral": "Saúde Geral",
		};
		return map[categoryId] || categoryId.replace("-", " ");
	};

	if (selectedArticle && article) {
		return (
			<div className="max-w-4xl mx-auto p-6">
				<button
					onClick={() => setSelectedArticle(null)}
					className="flex items-center text-blue-600 hover:text-blue-800 mb-6"
				>
					← Voltar à biblioteca
				</button>

				<article className="bg-white border border-blue-200 rounded-lg p-8">
					<header className="mb-6">
						<h1 className="text-3xl font-bold text-blue-900 mb-2">{article.title}</h1>
						<div className="flex items-center space-x-4 text-sm text-blue-600">
							<span>{categoryLabel(article.category)}</span>
							<span>•</span>
							<span>{article.readingTime} min leitura</span>
						</div>
					</header>

					<div className="mb-6">
						<div className="h-40 border border-dashed border-blue-200 rounded-lg flex items-center justify-center text-blue-700 text-sm">
							Imagem ilustrativa
						</div>
					</div>

					<div className="prose prose-blue max-w-none mb-8">
						<div className="whitespace-pre-line text-gray-700 leading-relaxed">
							{article.content}
						</div>
					</div>

					<div className="border-t border-blue-200 pt-6">
						<div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
							<h3 className="font-semibold text-red-800 mb-3 flex items-center">
								⚠️ Quando procurar ajuda
							</h3>
							<div className="text-red-700 whitespace-pre-line">
								{article.whenToSeekHelp}
							</div>
						</div>

						<div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
							<h3 className="font-semibold text-blue-800 mb-3">Precisa de apoio?</h3>
							<p className="text-blue-700 mb-4">
								Se tiver dúvidas sobre este tema, fale com um profissional de saúde.
							</p>
							<button
								onClick={() => {
									if (onStartTriage) {
										onStartTriage(article.category);
									} else {
										window.location.hash = `#triage-${article.category}`;
									}
								}}
								className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
							>
								Iniciar conversa
							</button>
						</div>
					</div>
				</article>
			</div>
		);
	}

	return (
		<div className="max-w-6xl mx-auto p-6">
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-blue-900 mb-2">Conteúdos Educativos</h2>
				<p className="text-blue-700">
					Informação baseada em evidência para apoiar decisões informadas.
				</p>
			</div>

			<div className="mb-6">
				<input
					type="search"
					placeholder="Pesquisar..."
					className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
				/>
			</div>

			<div className="mb-6">
				<div className="flex flex-wrap gap-3">
					<button
						onClick={() => setSelectedCategory(null)}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							selectedCategory === null
								? "bg-blue-600 text-white border-blue-600"
								: "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
						}`}
					>
						Todos
					</button>
					{categories.map((category) => (
						<button
							key={category.id}
							onClick={() => setSelectedCategory(category.id)}
							className={`px-4 py-2 rounded-lg border transition-colors flex items-center space-x-2 ${
								selectedCategory === category.id
									? "bg-blue-600 text-white border-blue-600"
									: "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
							}`}
						>
							<span>{category.icon}</span>
							<span>{category.title}</span>
						</button>
					))}
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{articles?.map((article) => (
					<div
						key={article._id}
						onClick={() => setSelectedArticle(article._id)}
						className="bg-white border border-blue-200 rounded-lg p-6 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all"
					>
						<div className="mb-4">
							<h3 className="text-lg font-semibold text-blue-900 mb-2">{article.title}</h3>
							<div className="flex items-center space-x-3 text-sm text-blue-600">
								<span>{categoryLabel(article.category)}</span>
								<span>•</span>
								<span>{article.readingTime} min leitura</span>
							</div>
						</div>

						<div className="text-gray-600 text-sm mb-4 line-clamp-3">
							{article.content.substring(0, 150)}...
						</div>

						<div className="flex flex-wrap gap-2">
							{article.tags.slice(0, 3).map((tag) => (
								<span
									key={tag}
									className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
								>
									{tag}
								</span>
							))}
						</div>
					</div>
				))}
			</div>

			{articles?.length === 0 && (
				<div className="text-center py-12">
					<p className="text-gray-500">Não foram encontrados conteúdos para este tópico.</p>
				</div>
			)}

			<div className="mt-10 p-6 bg-gray-50 border border-gray-200 rounded-lg">
				<h3 className="font-semibold text-gray-900 mb-2">Aviso importante</h3>
				<p className="text-gray-700 text-sm">
					A informação disponibilizada é educativa e não substitui aconselhamento médico.
					Em caso de urgência, ligue 112 ou contacte o SNS24.
				</p>
			</div>
		</div>
	);
}
