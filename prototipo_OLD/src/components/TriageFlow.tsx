import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface TriageFlowProps {
	category: string;
	onComplete: (conversationId: string) => void;
	onBack: () => void;
}

export function TriageFlow({ category, onComplete, onBack }: TriageFlowProps) {
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [responses, setResponses] = useState<Record<string, any>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);

	const triageData = useQuery(api.triage.getTriageQuestions, { category });
	const createConversation = useMutation(api.conversations.createConversation);

	if (!triageData) {
		return (
			<div className="flex justify-center items-center min-h-[60vh]">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	const questions = triageData.questions;
	const currentQuestion = questions[currentQuestionIndex];
	const isLastQuestion = currentQuestionIndex === questions.length - 1;

	const handleAnswer = (answer: any) => {
		const newResponses = { ...responses, [currentQuestion.id]: answer };
		setResponses(newResponses);

		if (isLastQuestion) {
			handleSubmit(newResponses);
		} else {
			setCurrentQuestionIndex(currentQuestionIndex + 1);
		}
	};

	const handleSubmit = async (finalResponses: Record<string, any>) => {
		setIsSubmitting(true);

		try {
			const riskLevel = calculateRiskLevel(finalResponses, triageData);

			const conversationId = await createConversation({
				category,
				title: getCategoryTitle(category),
				triageData: {
					responses: finalResponses,
					riskLevel,
				},
			});

			onComplete(conversationId);
		} catch (error) {
			console.error("Error creating conversation:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handlePrevious = () => {
		if (currentQuestionIndex > 0) {
			setCurrentQuestionIndex(currentQuestionIndex - 1);
		}
	};

	if (isSubmitting) {
		return (
			<div className="max-w-2xl mx-auto p-6">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="text-blue-700">A criar a sua conversa...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-2xl mx-auto p-6">
			<div className="mb-6">
				<button
					onClick={onBack}
					className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
				>
					← Voltar aos tópicos
				</button>
				<h2 className="text-2xl font-bold text-blue-900 mb-2">
					{getCategoryTitle(category)}
				</h2>
				<div className="flex items-center space-x-2 text-sm text-blue-600">
					<span>Pergunta {currentQuestionIndex + 1} de {questions.length}</span>
					<div className="flex-1 bg-blue-200 rounded-full h-2">
						<div
							className="bg-blue-600 h-2 rounded-full transition-all"
							style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
						/>
					</div>
				</div>
			</div>

			<div className="bg-white border border-blue-200 rounded-lg p-6 mb-6">
				<h3 className="text-lg font-semibold text-blue-900 mb-4">
					{currentQuestion.question}
				</h3>

				{currentQuestion.type === "multiple-choice" && (
					<div className="space-y-3">
						{currentQuestion.options?.map((option) => (
							<button
								key={option}
								onClick={() => handleAnswer(option)}
								className="w-full p-4 text-left border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
							>
								{option}
							</button>
						))}
					</div>
				)}

				{currentQuestion.type === "yes-no" && (
					<div className="flex space-x-4">
						<button
							onClick={() => handleAnswer(true)}
							className="flex-1 p-4 border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
						>
							Sim
						</button>
						<button
							onClick={() => handleAnswer(false)}
							className="flex-1 p-4 border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
						>
							Não
						</button>
					</div>
				)}

				{currentQuestion.type === "scale" && (
					<div className="grid grid-cols-5 gap-2">
						{currentQuestion.options?.map((option) => (
							<button
								key={option}
								onClick={() => handleAnswer(parseInt(option))}
								className="p-3 border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-center"
							>
								{option}
							</button>
						))}
					</div>
				)}

				{currentQuestion.type === "text" && (
					<div>
						<textarea
							className="w-full p-4 border border-blue-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
							rows={4}
							placeholder="Descreva os seus sintomas ou dúvidas..."
							onChange={(e) => setResponses({ ...responses, [currentQuestion.id]: e.target.value })}
						/>
						<button
							onClick={() => handleAnswer(responses[currentQuestion.id] || "")}
							className="mt-3 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
							disabled={!responses[currentQuestion.id]?.trim()}
						>
							Continuar
						</button>
					</div>
				)}
			</div>

			{currentQuestionIndex > 0 && (
				<button
					onClick={handlePrevious}
					className="px-4 py-2 text-blue-600 hover:text-blue-800 transition-colors"
				>
					← Pergunta anterior
				</button>
			)}

			{currentQuestion.isRedFlag && (
				<div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
					<p className="text-red-800 text-sm">
						<strong>Atenção:</strong> se tiver sintomas graves, ligue 112 ou contacte o SNS24.
					</p>
				</div>
			)}
		</div>
	);
}

function calculateRiskLevel(responses: Record<string, any>, triageData: any): string {
  // Simple risk assessment logic
  const { riskAssessment } = triageData;
  
  // Check for high-risk indicators first
  for (const criteria of riskAssessment.highRisk.criteria) {
    if (evaluateCriteria(criteria, responses)) {
      return "high";
    }
  }
  
  // Check for medium-risk indicators
  for (const criteria of riskAssessment.mediumRisk.criteria) {
    if (evaluateCriteria(criteria, responses)) {
      return "medium";
    }
  }
  
  return "low";
}

function evaluateCriteria(criteria: string, responses: Record<string, any>): boolean {
  // Simple criteria evaluation
  if (criteria.includes(">=")) {
    const [field, value] = criteria.split(" >= ");
    return responses[field] >= parseInt(value);
  }
  if (criteria.includes("<=")) {
    const [field, value] = criteria.split(" <= ");
    return responses[field] <= parseInt(value);
  }
  if (criteria.includes(">")) {
    const [field, value] = criteria.split(" > ");
    return responses[field] > parseInt(value);
  }
  if (criteria.includes("==")) {
    const [field, value] = criteria.split(" == ");
    return responses[field] === value.replace(/['"]/g, "");
  }
  if (criteria.includes("!=")) {
    const [field, value] = criteria.split(" != ");
    return responses[field] !== value.replace(/['"]/g, "");
  }
  if (criteria.startsWith("!")) {
    const field = criteria.substring(1);
    return !responses[field] || responses[field] === false;
  }
  
  return responses[criteria] === true;
}

function getCategoryTitle(category: string): string {
	const titles: Record<string, string> = {
		"contracecao": "Contraceção",
		"gravidez": "Gravidez",
		"ist": "IST",
		"ciclo-menstrual": "Ciclo Menstrual",
		"geral": "Saúde Geral",
	};
	return titles[category] || "Saúde";
}
