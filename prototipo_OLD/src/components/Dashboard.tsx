import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface DashboardProps {
	onStartTriage: (category: string) => void;
	onSelectConversation: (id: string) => void;
	onOpenEducation: () => void;
	onOpenProfile: () => void;
	onOpenChat: () => void;
}

export function Dashboard({
	onStartTriage,
	onSelectConversation,
	onOpenEducation,
	onOpenProfile,
	onOpenChat,
}: DashboardProps) {
	const user = useQuery(api.users.getCurrentUser);
	const conversations = useQuery(api.conversations.getPatientConversations);

	const categories = [
		{
			id: "contracecao",
			title: "Contraceção",
			description: "Métodos, planeamento e dúvidas",
			icon: "💊",
			color: "bg-purple-100 border-purple-200 hover:bg-purple-200",
		},
		{
			id: "gravidez",
			title: "Gravidez",
			description: "Sintomas, exames e acompanhamento",
			icon: "🤱",
			color: "bg-green-100 border-green-200 hover:bg-green-200",
		},
		{
			id: "ist",
			title: "IST",
			description: "Prevenção, rastreio e sintomas",
			icon: "🧪",
			color: "bg-blue-100 border-blue-200 hover:bg-blue-200",
		},
		{
			id: "ciclo-menstrual",
			title: "Ciclo Menstrual",
			description: "Dor, irregularidades e dúvidas",
			icon: "🩸",
			color: "bg-pink-100 border-pink-200 hover:bg-pink-200",
		},
		{
			id: "geral",
			title: "Saúde Geral",
			description: "Outras questões de saúde",
			icon: "💬",
			color: "bg-gray-100 border-gray-200 hover:bg-gray-200",
		},
	];

	const latestConversation = conversations?.[0];
	const conversationCount = conversations?.length ?? 0;

	const priorityLabel = (priority?: string) => {
		if (!priority) return "Normal";
		const map: Record<string, string> = {
			urgent: "Urgente",
			high: "Alta",
			medium: "Média",
			low: "Baixa",
		};
		return map[priority] || "Normal";
	};

	return (
		<div className="max-w-4xl mx-auto p-6">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold text-blue-900 mb-1">
						Olá, {user?.name || user?.email || "utente"}!
					</h2>
					<p className="text-blue-700">O que precisa hoje?</p>
				</div>
				<button
					onClick={onOpenProfile}
					className="px-4 py-2 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
				>
					Perfil
				</button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<button
					onClick={() => {
						if (latestConversation) {
							onSelectConversation(latestConversation._id);
							onOpenChat();
						} else {
							onStartTriage("geral");
						}
					}}
					className="text-left p-5 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
				>
					<div className="font-semibold text-blue-900 mb-1">💬 Chat</div>
					<p className="text-sm text-blue-700">Falar com profissional de saúde</p>
					<p className="text-xs text-gray-600 mt-2">
						{conversationCount > 0
							? `Conversas ativas: ${conversationCount} • Prioridade: ${priorityLabel(latestConversation?.priority)}`
							: "Ainda sem conversas ativas"}
					</p>
				</button>

				<button
					onClick={onOpenEducation}
					className="text-left p-5 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
				>
					<div className="font-semibold text-blue-900 mb-1">📚 Conteúdos Educativos</div>
					<p className="text-sm text-blue-700">Artigos e informação validada</p>
				</button>

				<button
					onClick={() => onStartTriage("geral")}
					className="text-left p-5 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
				>
					<div className="font-semibold text-blue-900 mb-1">📋 Questionário</div>
					<p className="text-sm text-blue-700">Autoavaliação de saúde</p>
				</button>

				<div className="p-5 bg-white border border-blue-200 rounded-lg">
					<div className="font-semibold text-blue-900 mb-2">📊 Resumo do Perfil</div>
					<p className="text-sm text-blue-700">Tópicos abordados: {conversationCount}</p>
					<p className="text-sm text-blue-700">Anexos: 0 ficheiros</p>
					<button
						onClick={onOpenProfile}
						className="mt-3 text-sm text-blue-700 hover:text-blue-900"
					>
						Ver perfil completo →
					</button>
				</div>
			</div>

			<div className="mt-8 p-5 bg-red-50 border border-red-200 rounded-lg">
				<h3 className="font-semibold text-red-800 mb-1">Aviso de urgência</h3>
				<p className="text-red-700 text-sm">
					Se tiver sintomas graves, ligue 112 ou contacte o SNS24. Este serviço não substitui
					uma urgência médica.
				</p>
			</div>

			<div className="mt-8">
				<h3 className="text-lg font-semibold text-blue-900 mb-3">Iniciar novo tópico</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
					{categories.map((category) => (
						<button
							key={category.id}
							onClick={() => onStartTriage(category.id)}
							className={`p-4 border-2 rounded-lg text-left transition-all hover:shadow-md ${category.color}`}
						>
							<div className="flex items-start space-x-3">
								<span className="text-xl">{category.icon}</span>
								<div>
									<h4 className="font-semibold text-gray-900 mb-1">{category.title}</h4>
									<p className="text-sm text-gray-600">{category.description}</p>
								</div>
							</div>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
