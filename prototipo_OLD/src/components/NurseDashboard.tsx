import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface NurseDashboardProps {
	onSelectConversation: (id: string) => void;
}

export function NurseDashboard({ onSelectConversation }: NurseDashboardProps) {
	const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
	const [escalationLevel, setEscalationLevel] = useState("");
	const [escalationNotes, setEscalationNotes] = useState("");
	const [internalNote, setInternalNote] = useState("");
	const [scopeFilter, setScopeFilter] = useState<"mine" | "unassigned" | "all">("mine");
	const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

	const user = useQuery(api.users.getCurrentUser);
	const conversations = useQuery(api.conversations.getNurseQueue);
	const messages = useQuery(
		api.messages.getMessages,
		selectedConversation ? { conversationId: selectedConversation as Id<"conversations"> } : "skip"
	);

	const assignConversation = useMutation(api.conversations.assignConversation);
	const escalateConversation = useMutation(api.conversations.escalateConversation);
	const sendMessage = useMutation(api.messages.sendMessage);

	const handleAssign = async (conversationId: string) => {
		try {
			await assignConversation({ conversationId: conversationId as Id<"conversations"> });
		} catch (error) {
			console.error("Error assigning conversation:", error);
		}
	};

	const handleEscalate = async () => {
		if (!selectedConversation || !escalationLevel || !escalationNotes) return;

		try {
			await escalateConversation({
				conversationId: selectedConversation as Id<"conversations">,
				escalationLevel,
				notes: escalationNotes,
			});
			setEscalationLevel("");
			setEscalationNotes("");
		} catch (error) {
			console.error("Error escalating conversation:", error);
		}
	};

	const handleAddInternalNote = async () => {
		if (!selectedConversation || !internalNote.trim()) return;

		try {
			await sendMessage({
				conversationId: selectedConversation as Id<"conversations">,
				content: internalNote,
				messageType: "text",
				isInternal: true,
			});
			setInternalNote("");
		} catch (error) {
			console.error("Error adding internal note:", error);
		}
	};

	const selectedConversationData = conversations?.find(c => c._id === selectedConversation);
	const mineCount = conversations?.filter(c => c.nurseId === user?._id).length ?? 0;
	const unassignedCount = conversations?.filter(c => c.status === "waiting").length ?? 0;

	const filteredConversations = (conversations ?? []).filter((conversation) => {
		if (scopeFilter === "mine" && conversation.nurseId !== user?._id) return false;
		if (scopeFilter === "unassigned" && conversation.status !== "waiting") return false;
		if (priorityFilter && conversation.priority !== priorityFilter) return false;
		return true;
	});

	const priorityLabel = (priority?: string) => {
		const map: Record<string, string> = {
			urgent: "Urgente",
			high: "Alta",
			medium: "Média",
			low: "Baixa",
		};
		return priority ? map[priority] || priority : "Normal";
	};

	const riskLabel = (risk?: string) => {
		const map: Record<string, string> = {
			high: "Alto",
			medium: "Médio",
			low: "Baixo",
		};
		return risk ? map[risk] || risk : "-";
	};

	return (
		<div className="max-w-6xl mx-auto p-6">
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-blue-900 mb-2">Lista de Chats</h2>
				<p className="text-blue-700">Gestão de conversas e prioridades clínicas</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
				<div className="bg-white border border-blue-200 rounded-lg p-4 text-center">
					<div className="text-2xl font-bold text-blue-900">{mineCount}</div>
					<div className="text-sm text-blue-700">Meus chats</div>
				</div>
				<div className="bg-white border border-blue-200 rounded-lg p-4 text-center">
					<div className="text-2xl font-bold text-blue-900">{unassignedCount}</div>
					<div className="text-sm text-blue-700">Não atribuídos</div>
				</div>
			</div>

			<div className="flex flex-wrap gap-2 mb-4">
				{[
					{ id: "mine", label: "Meus chats" },
					{ id: "unassigned", label: "Não atribuídos" },
					{ id: "all", label: "Todos" },
				].map((item) => (
					<button
						key={item.id}
						onClick={() => setScopeFilter(item.id as "mine" | "unassigned" | "all")}
						className={`px-4 py-2 rounded-lg border text-sm ${
							scopeFilter === item.id
								? "bg-blue-600 text-white border-blue-600"
								: "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
						}`}
					>
						{item.label}
					</button>
				))}
			</div>

			<div className="flex flex-wrap gap-2 mb-6">
				{[
					{ id: "urgent", label: "Urgente" },
					{ id: "high", label: "Alta" },
					{ id: "medium", label: "Média" },
					{ id: "low", label: "Baixa" },
				].map((item) => (
					<button
						key={item.id}
						onClick={() => setPriorityFilter(priorityFilter === item.id ? null : item.id)}
						className={`px-3 py-1 rounded-lg border text-xs ${
							priorityFilter === item.id
								? "bg-blue-600 text-white border-blue-600"
								: "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
						}`}
					>
						{item.label}
					</button>
				))}
			</div>

			<div className="space-y-3">
				{filteredConversations.map((conversation) => (
					<div
						key={conversation._id}
						onClick={() => setSelectedConversation(conversation._id)}
						className={`p-4 border rounded-lg cursor-pointer transition-colors ${
							selectedConversation === conversation._id
								? "border-blue-500 bg-blue-50"
								: "border-gray-200 hover:bg-gray-50"
						}`}
					>
						<div className="flex justify-between items-start mb-2">
							<div>
								<h4 className="font-medium text-gray-900">{conversation.title}</h4>
								<p className="text-sm text-gray-600">
									Tópico: {conversation.title}
								</p>
							</div>
							<span className={`px-2 py-1 text-xs rounded-full ${
								conversation.priority === "urgent" ? "bg-red-100 text-red-800" :
								conversation.priority === "high" ? "bg-orange-100 text-orange-800" :
								conversation.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
								"bg-green-100 text-green-800"
							}`}>
								{priorityLabel(conversation.priority)}
							</span>
						</div>
						<div className="flex justify-between items-center text-xs text-gray-500">
							<span className={`px-2 py-1 rounded ${
								conversation.status === "waiting" ? "bg-yellow-100 text-yellow-800" :
								conversation.status === "active" ? "bg-green-100 text-green-800" :
								conversation.status === "escalated" ? "bg-red-100 text-red-800" :
								"bg-gray-100 text-gray-800"
							}`}>
								{conversation.status === "waiting"
									? "À espera"
									: conversation.status === "active"
									? "Ativo"
									: conversation.status === "escalated"
									? "Escalado"
									: "Fechado"}
							</span>
							<span>{new Date(conversation.lastMessageAt).toLocaleDateString("pt-PT")}</span>
						</div>
						{conversation.status === "waiting" && (
							<button
								onClick={(e) => {
									e.stopPropagation();
									handleAssign(conversation._id);
								}}
								className="mt-3 w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
							>
								Atribuir a mim
							</button>
						)}
					</div>
				))}
			</div>

			{selectedConversation && selectedConversationData ? (
				<div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
					<div className="flex justify-between items-start mb-4">
						<div>
							<h3 className="text-xl font-bold text-gray-900">{selectedConversationData.title}</h3>
							<p className="text-gray-600">Tópico: {selectedConversationData.title}</p>
						</div>
						<button
							onClick={() => onSelectConversation(selectedConversation)}
							className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
						>
							Abrir chat
						</button>
					</div>

					{messages && (
						<div className="mb-4">
							{messages
								.filter(m => m.metadata?.triageData)
								.map(message => (
									<div key={message._id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
										<h4 className="font-semibold text-blue-900 mb-2">Triagem</h4>
										<p className="text-sm text-blue-800 mb-2">
											Nível de risco: <span className="font-medium">{riskLabel(message.metadata?.triageData?.riskLevel)}</span>
										</p>
										<div className="text-sm text-blue-700">
											<strong>Respostas:</strong>
											<ul className="mt-1 space-y-1">
												{Object.entries(message.metadata?.triageData?.responses || {}).map(([key, value]) => (
													<li key={key}>
														<span className="font-medium">{key}:</span> {String(value)}
													</li>
												))}
											</ul>
										</div>
									</div>
								))}
						</div>
					)}

					<div className="border-t border-gray-200 pt-4">
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Adicionar nota interna
						</label>
						<div className="flex space-x-2">
							<textarea
								value={internalNote}
								onChange={(e) => setInternalNote(e.target.value)}
								placeholder="Escreva uma nota para outros profissionais..."
								className="flex-1 p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
								rows={2}
							/>
							<button
								onClick={handleAddInternalNote}
								disabled={!internalNote.trim()}
								className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
							>
								Guardar
							</button>
						</div>
					</div>

					<div className="mt-6">
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Escalar conversa
						</label>
						<div className="space-y-3">
							<select
								value={escalationLevel}
								onChange={(e) => setEscalationLevel(e.target.value)}
								className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
							>
								<option value="">Selecionar nível de escalamento...</option>
								<option value="routine">Consulta de rotina</option>
								<option value="urgent">Consulta urgente (48h)</option>
								<option value="same-day">Urgência no próprio dia</option>
								<option value="emergency">Emergência imediata</option>
							</select>
							<textarea
								value={escalationNotes}
								onChange={(e) => setEscalationNotes(e.target.value)}
								placeholder="Notas e recomendações..."
								className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
								rows={3}
							/>
							<button
								onClick={handleEscalate}
								disabled={!escalationLevel || !escalationNotes.trim()}
								className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
							>
								Escalar
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
