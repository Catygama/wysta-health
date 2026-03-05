import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import React from "react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { ConversationView } from "./components/ConversationView";
import { TriageFlow } from "./components/TriageFlow";
import { EducationLibrary } from "./components/EducationLibrary";
import { ProfileSetup } from "./components/ProfileSetup";
import { NurseDashboard } from "./components/NurseDashboard";

export default function App() {
	const [currentView, setCurrentView] = useState<"dashboard" | "conversation" | "triage" | "education" | "profile" | "nurse-dashboard">("dashboard");
	const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
	const [triageCategory, setTriageCategory] = useState<string | null>(null);

  // Ensure userProfile exists for every authenticated user
	const ensureProfile = useMutation(api.users.ensureUserProfile);
	const user = useQuery(api.users.getCurrentUser);
	const isNurse = user?.profile?.isNurse;
  // Only call on mount and when user changes
	React.useEffect(() => {
		if (user && user._id) {
			ensureProfile({});
		}
		// eslint-disable-next-line
	}, [user && user._id]);

	React.useEffect(() => {
		if (user && isNurse && currentView === "dashboard") {
			setCurrentView("nurse-dashboard");
		}
	}, [currentView, isNurse, user]);

	return (
		<div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50">
			<header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-blue-100 shadow-sm">
				<div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
					<div className="flex items-center space-x-4">
						<h1 className="text-xl font-bold text-blue-900">WystaHealth</h1>
						<Authenticated>
							{isNurse ? (
								<Navigation currentView={currentView} setCurrentView={setCurrentView} />
							) : null}
						</Authenticated>
					</div>
					<Authenticated>
						<SignOutButton />
					</Authenticated>
				</div>
			</header>

			<main className="flex-1">
				<Unauthenticated>
					<div className="flex items-center justify-center min-h-[80vh] p-4">
						<div className="w-full max-w-md">
							<div className="text-center mb-8">
								<h2 className="text-3xl font-bold text-blue-900 mb-2">Bem-vinda/o à WystaHealth</h2>
								<p className="text-blue-700">Apoio de saúde confidencial quando precisar</p>
							</div>
							<SignInForm />
							<div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
								<p className="text-sm text-blue-800">
									<strong>Importante:</strong> este serviço não é destinado a emergências.
									Em caso de urgência, ligue 112 ou contacte o SNS24.
								</p>
							</div>
						</div>
					</div>
				</Unauthenticated>

				<Authenticated>
					<div className={isNurse ? "" : "pb-24"}>
						<Content
							currentView={currentView}
							setCurrentView={setCurrentView}
							selectedConversationId={selectedConversationId}
							setSelectedConversationId={setSelectedConversationId}
							triageCategory={triageCategory}
							setTriageCategory={setTriageCategory}
						/>
					</div>
				</Authenticated>
			</main>
			<Authenticated>
				{!isNurse ? (
					<BottomNav currentView={currentView} setCurrentView={setCurrentView} />
				) : null}
			</Authenticated>
			<Toaster />
		</div>
	);
}

function Navigation({
	currentView,
	setCurrentView,
}: {
	currentView: string;
	setCurrentView: (view: "dashboard" | "conversation" | "triage" | "education" | "profile" | "nurse-dashboard") => void;
}) {
	return (
		<nav className="flex space-x-6">
			<button
				onClick={() => setCurrentView("nurse-dashboard")}
				className={`text-sm font-medium transition-colors ${
					currentView === "nurse-dashboard"
						? "text-blue-900 border-b-2 border-blue-900"
						: "text-blue-600 hover:text-blue-900"
				}`}
			>
				Chats
			</button>
		</nav>
	);
}

function Content({
	currentView,
	setCurrentView,
	selectedConversationId,
	setSelectedConversationId,
	triageCategory,
	setTriageCategory,
}: {
	currentView: string;
	setCurrentView: (view: "dashboard" | "conversation" | "triage" | "education" | "profile" | "nurse-dashboard") => void;
	selectedConversationId: string | null;
	setSelectedConversationId: (id: string | null) => void;
	triageCategory: string | null;
	setTriageCategory: (category: string | null) => void;
}) {
	const user = useQuery(api.users.getCurrentUser);
	const patientConversations = useQuery(api.conversations.getPatientConversations);
	const isNurse = user?.profile?.isNurse;

	React.useEffect(() => {
		if (!isNurse && currentView === "conversation" && !selectedConversationId && patientConversations?.length) {
			setSelectedConversationId(patientConversations[0]._id);
		}
	}, [currentView, isNurse, patientConversations, selectedConversationId, setSelectedConversationId]);

	if (user === undefined) {
		return (
			<div className="flex justify-center items-center min-h-[60vh]">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	switch (currentView) {
		case "conversation":
			return selectedConversationId ? (
				<ConversationView
					conversationId={selectedConversationId}
					onBack={() => setCurrentView("dashboard")}
					onAddTopic={() => setCurrentView("dashboard")}
				/>
			) : isNurse ? (
				<div className="p-8 text-center">
					<p className="text-gray-600">Selecione um chat para começar.</p>
				</div>
			) : (
				<div className="max-w-2xl mx-auto p-6">
					<div className="bg-white border border-blue-200 rounded-lg p-6 text-center">
						<h3 className="text-lg font-semibold text-blue-900 mb-2">Sem conversas ativas</h3>
						<p className="text-blue-700 mb-4">
							Inicie um tópico para falar com um profissional de saúde.
						</p>
						<button
							onClick={() => setCurrentView("dashboard")}
							className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
						>
							Escolher tópico
						</button>
					</div>
				</div>
			);

		case "triage":
			return triageCategory ? (
				<TriageFlow
					category={triageCategory}
					onComplete={(conversationId) => {
						setSelectedConversationId(conversationId);
						setCurrentView("conversation");
					}}
					onBack={() => setCurrentView("dashboard")}
				/>
			) : null;

		case "education":
			return (
				<EducationLibrary
					onStartTriage={(category) => {
						setTriageCategory(category);
						setCurrentView("triage");
					}}
				/>
			);

		case "profile":
			return <ProfileSetup />;

		case "nurse-dashboard":
			return user?.profile?.isNurse ? (
				<NurseDashboard
					onSelectConversation={(id) => {
						setSelectedConversationId(id);
						setCurrentView("conversation");
					}}
				/>
			) : (
				<div className="p-8 text-center">
					<p className="text-red-600">Acesso restrito. Requer permissões de profissional.</p>
				</div>
			);

		default:
			return (
				<Dashboard
					onStartTriage={(category) => {
						setTriageCategory(category);
						setCurrentView("triage");
					}}
					onSelectConversation={(id) => {
						setSelectedConversationId(id);
						setCurrentView("conversation");
					}}
					onOpenEducation={() => setCurrentView("education")}
					onOpenProfile={() => setCurrentView("profile")}
					onOpenChat={() => setCurrentView("conversation")}
				/>
			);
	}
}

function BottomNav({
	currentView,
	setCurrentView,
}: {
	currentView: string;
	setCurrentView: (view: "dashboard" | "conversation" | "triage" | "education" | "profile" | "nurse-dashboard") => void;
}) {
	const items = [
		{ id: "dashboard", label: "Início" },
		{ id: "conversation", label: "Chat" },
		{ id: "education", label: "Conteúdos" },
		{ id: "profile", label: "Perfil" },
	] as const;

	return (
		<nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-blue-100 shadow-sm">
			<div className="max-w-2xl mx-auto grid grid-cols-4">
				{items.map((item) => (
					<button
						key={item.id}
						onClick={() => setCurrentView(item.id)}
						className={`py-3 text-sm font-medium transition-colors ${
							currentView === item.id
								? "text-blue-900 bg-blue-50"
								: "text-blue-600 hover:text-blue-900"
						}`}
					>
						{item.label}
					</button>
				))}
			</div>
		</nav>
	);
}
