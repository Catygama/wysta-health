"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
	const { signIn } = useAuthActions();
	const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
	const [submitting, setSubmitting] = useState(false);

	return (
		<div className="w-full">
			<form
				className="flex flex-col gap-form-field"
				onSubmit={(e) => {
					e.preventDefault();
					setSubmitting(true);
					const formData = new FormData(e.target as HTMLFormElement);
					formData.set("flow", flow);
					void signIn("password", formData).catch((error) => {
						let toastTitle = "";
						if (error.message.includes("Invalid password")) {
							toastTitle = "Palavra-passe inválida. Tente novamente.";
						} else {
							toastTitle =
								flow === "signIn"
									? "Não foi possível entrar. Queria criar conta?"
									: "Não foi possível criar conta. Queria entrar?";
						}
						toast.error(toastTitle);
						setSubmitting(false);
					});
				}}
			>
				<input
					className="auth-input-field"
					type="email"
					name="email"
					placeholder="Email"
					required
				/>
				<input
					className="auth-input-field"
					type="password"
					name="password"
					placeholder="Palavra-passe"
					required
				/>
				<button className="auth-button" type="submit" disabled={submitting}>
					{flow === "signIn" ? "Entrar" : "Criar conta"}
				</button>
				<div className="text-center text-sm text-secondary">
					<span>
						{flow === "signIn"
							? "Ainda não tem conta? "
							: "Já tem conta? "}
					</span>
					<button
						type="button"
						className="text-primary hover:text-primary-hover hover:underline font-medium cursor-pointer"
						onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
					>
						{flow === "signIn" ? "Criar conta" : "Entrar"}
					</button>
				</div>
			</form>
			<div className="flex items-center justify-center my-3">
				<hr className="my-4 grow border-gray-200" />
				<span className="mx-4 text-secondary">ou</span>
				<hr className="my-4 grow border-gray-200" />
			</div>
			<button className="auth-button" onClick={() => void signIn("anonymous")}>
				Entrar anonimamente
			</button>
		</div>
	);
}
