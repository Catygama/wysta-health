import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface ConversationViewProps {
	conversationId: string;
	onBack: () => void;
	onAddTopic?: () => void;
}

export function ConversationView({ conversationId, onBack, onAddTopic }: ConversationViewProps) {
	const [newMessage, setNewMessage] = useState("");
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [activeTab, setActiveTab] = useState<"chat" | "notas" | "sumario">("chat");
	const [internalNote, setInternalNote] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const conversation = useQuery(
		api.conversations.getConversationById,
		{ conversationId: conversationId as Id<"conversations"> }
	);
	const messages = useQuery(api.messages.getMessages, {
		conversationId: conversationId as Id<"conversations">,
	});
	const user = useQuery(api.users.getCurrentUser);

	const sendMessage = useMutation(api.messages.sendMessage);
	const generateUploadUrl = useMutation(api.messages.generateUploadUrl);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, activeTab]);

	const handleSendMessage = async () => {
		if (!newMessage.trim() && !selectedImage) return;

		try {
			let imageId: Id<"_storage"> | undefined;

			if (selectedImage) {
				setIsUploading(true);
				const uploadUrl = await generateUploadUrl();

				const result = await fetch(uploadUrl, {
					method: "POST",
					headers: { "Content-Type": selectedImage.type },
					body: selectedImage,
				});

				if (!result.ok) {
					throw new Error("Upload failed");
				}

				const { storageId } = await result.json();
				imageId = storageId;
			}

			await sendMessage({
				conversationId: conversationId as Id<"conversations">,
				content: newMessage || "Imagem partilhada",
				messageType: selectedImage ? "image" : "text",
				imageId,
			});

			setNewMessage("");
			setSelectedImage(null);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		} catch (error) {
			console.error("Error sending message:", error);
		} finally {
			setIsUploading(false);
		}
	};

	const handleAddInternalNote = async () => {
		if (!internalNote.trim()) return;

		try {
			await sendMessage({
				conversationId: conversationId as Id<"conversations">,
				content: internalNote.trim(),
				messageType: "text",
				isInternal: true,
			});
			setInternalNote("");
		} catch (error) {
			console.error("Error adding internal note:", error);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	if (!conversation || !messages) {
		return (
			<div className="flex justify-center items-center min-h-[60vh]">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	const isNurse = user?.profile?.isNurse;
	const isAssignedToNurse = conversation.nurseId === user?._id;

	const statusLabel = (status: string) => {
		const map: Record<string, string> = {
			waiting: "Aguardar",
			active: "Ativo",
			escalated: "Escalado",
			closed: "Fechado",
		};
		return map[status] || status;
	};

	const priorityLabel = (priority: string) => {
		const map: Record<string, string> = {
			urgent: "Urgente",
			high: "Alta",
			medium: "Média",
			low: "Baixa",
		};
		return map[priority] || priority;
	};

	const riskLabel = (risk: string) => {
		const map: Record<string, string> = {
			high: "Alto",
			medium: "Médio",
			low: "Baixo",
		};
		return map[risk] || risk;
	};

	const filteredMessages = messages.filter((message) => {
		if (!isNurse) return !message.isInternal;
		if (activeTab === "notas") return message.isInternal;
		if (activeTab === "chat") return !message.isInternal;
		return false;
	});

	return (
		<div className="max-w-4xl mx-auto min-h-[calc(100vh-6rem)] flex flex-col">
			<div className="p-4 border-b border-blue-200 bg-white">
				<div className="flex items-center justify-between mb-2">
					<button
						onClick={onBack}
						className="flex items-center text-blue-600 hover:text-blue-800"
					>
						{isNurse ? "← Lista" : "← Voltar"}
					</button>
					{!isNurse && onAddTopic ? (
						<button
							onClick={onAddTopic}
							className="text-blue-600 hover:text-blue-800"
						>
							+ Tópico
						</button>
					) : null}
				</div>
				<div className="flex justify-between items-start">
					<div>
						<h2 className="text-xl font-bold text-blue-900">Chat</h2>
						<div className="flex flex-wrap items-center gap-2 text-sm text-blue-600">
							<span>Tópico: {conversation.title}</span>
							<span className={`px-2 py-1 rounded-full text-xs ${
								conversation.status === "waiting" ? "bg-yellow-100 text-yellow-800" :
								conversation.status === "active" ? "bg-green-100 text-green-800" :
								conversation.status === "escalated" ? "bg-red-100 text-red-800" :
								"bg-gray-100 text-gray-800"
							}`}>
								{statusLabel(conversation.status)}
							</span>
							<span className={`px-2 py-1 rounded-full text-xs ${
								conversation.priority === "urgent" ? "bg-red-100 text-red-800" :
								conversation.priority === "high" ? "bg-orange-100 text-orange-800" :
								conversation.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
								"bg-green-100 text-green-800"
							}`}>
								Prioridade {priorityLabel(conversation.priority)}
							</span>
						</div>
						{isNurse && (
							<p className="text-xs text-gray-600 mt-1">
								{isAssignedToNurse ? "Atribuído a si" : "Não atribuído a si"}
							</p>
						)}
					</div>
					{conversation.escalationLevel && (
						<div className="text-right">
							<span className="text-sm font-medium text-red-600">
								Escalado: {conversation.escalationLevel}
							</span>
							{conversation.escalationNotes && (
								<p className="text-xs text-red-500 mt-1">{conversation.escalationNotes}</p>
							)}
						</div>
					)}
				</div>
				{isNurse ? (
					<div className="mt-3 flex gap-2 text-sm">
						<button
							onClick={() => setActiveTab("chat")}
							className={`px-3 py-2 rounded-lg border ${
								activeTab === "chat"
									? "bg-blue-600 text-white border-blue-600"
									: "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
							}`}
						>
							Chat
						</button>
						<button
							onClick={() => setActiveTab("notas")}
							className={`px-3 py-2 rounded-lg border ${
								activeTab === "notas"
									? "bg-blue-600 text-white border-blue-600"
									: "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
							}`}
						>
							Notas internas
						</button>
						<button
							onClick={() => setActiveTab("sumario")}
							className={`px-3 py-2 rounded-lg border ${
								activeTab === "sumario"
									? "bg-blue-600 text-white border-blue-600"
									: "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
							}`}
						>
							Sumário
						</button>
					</div>
				) : null}
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
				{activeTab === "sumario" && isNurse ? (
					<div className="bg-white border border-blue-200 rounded-lg p-6">
						<h3 className="text-lg font-semibold text-blue-900 mb-2">Sumário da conversa</h3>
						<p className="text-blue-700 text-sm">
							O sumário automático estará disponível para conversas longas.
						</p>
					</div>
				) : (
					filteredMessages.map((message) => {
						const isOwnMessage = message.senderId === user?._id;
						const isSystemMessage = message.messageType === "system" || message.messageType === "triage-response";

						return (
							<div
								key={message._id}
								className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} ${
									isSystemMessage ? "justify-center" : ""
								}`}
							>
								<div
									className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
										isSystemMessage
											? "bg-blue-100 text-blue-800 text-sm"
											: isOwnMessage
											? "bg-blue-600 text-white"
											: message.isInternal
											? "bg-yellow-100 text-yellow-800 border border-yellow-300"
											: "bg-white text-gray-900 border border-gray-200"
									}`}
								>
									{message.isInternal && (
										<div className="text-xs font-medium mb-1">Nota interna</div>
									)}

									{message.messageType === "image" && message.imageUrl && (
										<div className="mb-2">
											<img
												src={message.imageUrl}
												alt="Imagem partilhada"
												className="max-w-full h-auto rounded"
											/>
										</div>
									)}

									<p className="whitespace-pre-wrap">{message.content}</p>

									{message.metadata?.triageData && (
										<div className="mt-2 text-xs opacity-75">
											<p>Nível de risco: {riskLabel(message.metadata.triageData.riskLevel)}</p>
										</div>
									)}

									<div className={`text-xs mt-1 ${
										isOwnMessage ? "text-blue-200" : "text-gray-500"
									}`}>
										{new Date(message._creationTime).toLocaleTimeString("pt-PT", {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</div>
								</div>
							</div>
						);
					})
				)}
				<div ref={messagesEndRef} />
			</div>

			{conversation.status !== "closed" && activeTab !== "sumario" && (
				<div className="p-4 border-t border-blue-200 bg-white">
					{!isNurse && (
						<div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
							<p className="text-sm text-amber-800">
								<strong>Imagens:</strong> partilhe apenas informação relevante (ex.: exames, receitas).
							</p>
						</div>
					)}

					{selectedImage && (
						<div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
							<div className="flex items-center justify-between">
								<span className="text-sm text-blue-800">
									Ficheiro: {selectedImage.name}
								</span>
								<button
									onClick={() => {
										setSelectedImage(null);
										if (fileInputRef.current) fileInputRef.current.value = "";
									}}
									className="text-red-600 hover:text-red-800"
								>
									Remover
								</button>
							</div>
						</div>
					)}

					{activeTab === "notas" && isNurse ? (
						<div className="flex space-x-2">
							<textarea
								value={internalNote}
								onChange={(e) => setInternalNote(e.target.value)}
								placeholder="Escreva uma nota interna..."
								className="flex-1 p-3 border border-blue-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
								rows={2}
							/>
							<button
								onClick={handleAddInternalNote}
								disabled={!internalNote.trim()}
								className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								Guardar
							</button>
						</div>
					) : (
						<div className="flex space-x-2">
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
								className="hidden"
							/>
							<button
								onClick={() => fileInputRef.current?.click()}
								className="px-3 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
								disabled={isUploading}
							>
								📎
							</button>
							<textarea
								value={newMessage}
								onChange={(e) => setNewMessage(e.target.value)}
								onKeyPress={handleKeyPress}
								placeholder="Escreva a sua mensagem..."
								className="flex-1 p-3 border border-blue-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
								rows={2}
								disabled={isUploading || (isNurse && !isAssignedToNurse)}
							/>
							<button
								onClick={handleSendMessage}
								disabled={(!newMessage.trim() && !selectedImage) || isUploading || (isNurse && !isAssignedToNurse)}
								className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								{isUploading ? "..." : "Enviar"}
							</button>
						</div>
					)}

					{isNurse && !isAssignedToNurse && activeTab === "chat" && (
						<p className="text-xs text-gray-600 mt-2">
							Para responder, atribua o chat a si.
						</p>
					)}
				</div>
			)}

			{!isNurse && (
				<p className="text-xs text-center text-gray-600 py-2">
					As respostas podem demorar algumas horas.
				</p>
			)}
		</div>
	);
}
