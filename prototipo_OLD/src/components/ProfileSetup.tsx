import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function ProfileSetup() {
	// Ensure userProfile exists on mount
	const ensureProfile = useMutation(api.users.ensureUserProfile);
	const [profileEnsured, setProfileEnsured] = useState(false);

	useEffect(() => {
		ensureProfile({}).finally(() => setProfileEnsured(true));
		// eslint-disable-next-line
	}, []);

	const user = useQuery(api.users.getCurrentUser);
	const updateProfile = useMutation(api.users.updateProfile);
	const makeMeNurse = useMutation(api.users.makeMeNurse);

	const [formData, setFormData] = useState({
		ageRange: "",
		location: "",
		pregnancyStatus: "",
		conditions: [] as string[],
		medications: [] as string[],
	});

	const [newCondition, setNewCondition] = useState("");
	const [newMedication, setNewMedication] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (user?.profile) {
			setFormData({
				ageRange: user.profile.ageRange || "",
				location: user.profile.location || "",
				pregnancyStatus: user.profile.pregnancyStatus || "",
				conditions: user.profile.conditions || [],
				medications: user.profile.medications || [],
			});
		}
	}, [user]);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await updateProfile(formData);
		} catch (error) {
			console.error("Error updating profile:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const addCondition = () => {
		if (newCondition.trim() && !formData.conditions.includes(newCondition.trim())) {
			setFormData({
				...formData,
				conditions: [...formData.conditions, newCondition.trim()],
			});
			setNewCondition("");
		}
	};

	const removeCondition = (condition: string) => {
		setFormData({
			...formData,
			conditions: formData.conditions.filter(c => c !== condition),
		});
	};

	const addMedication = () => {
		if (newMedication.trim() && !formData.medications.includes(newMedication.trim())) {
			setFormData({
				...formData,
				medications: [...formData.medications, newMedication.trim()],
			});
			setNewMedication("");
		}
	};

	const removeMedication = (medication: string) => {
		setFormData({
			...formData,
			medications: formData.medications.filter(m => m !== medication),
		});
	};

	if (!user || !profileEnsured) {
		return (
			<div className="flex justify-center items-center min-h-[60vh]">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	return (
		<div className="max-w-2xl mx-auto p-6">
			<div className="mb-8">
				<h2 className="text-2xl font-bold text-blue-900 mb-2">Perfil</h2>
				<p className="text-blue-700">
					Estes dados ajudam a personalizar o acompanhamento. Toda a informação é opcional
					e confidencial.
				</p>
			</div>

			<div className="bg-white border border-blue-200 rounded-lg p-6 space-y-6">
				<div>
					<h3 className="text-lg font-semibold text-blue-900 mb-4">Informação básica</h3>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Faixa etária
							</label>
							<select
								value={formData.ageRange}
								onChange={(e) => setFormData({ ...formData, ageRange: e.target.value })}
								className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
							>
								<option value="">Selecionar</option>
								<option value="under-18">Menos de 18</option>
								<option value="18-25">18-25</option>
								<option value="26-35">26-35</option>
								<option value="36-45">36-45</option>
								<option value="46-55">46-55</option>
								<option value="over-55">Mais de 55</option>
							</select>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Localização
							</label>
							<input
								type="text"
								value={formData.location}
								onChange={(e) => setFormData({ ...formData, location: e.target.value })}
								placeholder="ex.: Portugal"
								className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
							/>
						</div>
					</div>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Estado de gravidez
					</label>
					<select
						value={formData.pregnancyStatus}
						onChange={(e) => setFormData({ ...formData, pregnancyStatus: e.target.value })}
						className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
					>
						<option value="">Selecionar</option>
						<option value="not-pregnant">Não grávida</option>
						<option value="pregnant">Grávida</option>
						<option value="trying">A tentar engravidar</option>
						<option value="postpartum">Pós-parto</option>
						<option value="prefer-not-to-say">Prefiro não responder</option>
					</select>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Condições relevantes
					</label>
					<div className="space-y-3">
						<div className="flex space-x-2">
							<input
								type="text"
								value={newCondition}
								onChange={(e) => setNewCondition(e.target.value)}
								placeholder="Adicionar condição (ex.: SOP, endometriose)"
								className="flex-1 p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
								onKeyPress={(e) => e.key === "Enter" && addCondition()}
							/>
							<button
								onClick={addCondition}
								className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
							>
								Adicionar
							</button>
						</div>
						{formData.conditions.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{formData.conditions.map((condition) => (
									<span
										key={condition}
										className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
									>
										{condition}
										<button
											onClick={() => removeCondition(condition)}
											className="ml-2 text-blue-600 hover:text-blue-800"
										>
											×
										</button>
									</span>
								))}
							</div>
						)}
					</div>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Medicação atual
					</label>
					<div className="space-y-3">
						<div className="flex space-x-2">
							<input
								type="text"
								value={newMedication}
								onChange={(e) => setNewMedication(e.target.value)}
								placeholder="Adicionar medicação"
								className="flex-1 p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
								onKeyPress={(e) => e.key === "Enter" && addMedication()}
							/>
							<button
								onClick={addMedication}
								className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
							>
								Adicionar
							</button>
						</div>
						{formData.medications.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{formData.medications.map((medication) => (
									<span
										key={medication}
										className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
									>
										{medication}
										<button
											onClick={() => removeMedication(medication)}
											className="ml-2 text-green-600 hover:text-green-800"
										>
											×
										</button>
									</span>
								))}
							</div>
						)}
					</div>
				</div>

				<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
					<h4 className="font-semibold text-blue-900 mb-2">Privacidade e dados</h4>
					<p className="text-blue-800 text-sm">
						A sua informação é tratada com confidencialidade. Apenas profissionais de saúde
						envolvidos no acompanhamento têm acesso.
					</p>
				</div>

				<div className="flex justify-end">
					<button
						onClick={handleSave}
						disabled={isSaving}
						className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
					>
						{isSaving ? "A guardar..." : "Guardar perfil"}
					</button>
					{(!user.profile || !user.profile.isNurse) && (
						<button
							onClick={async () => { await makeMeNurse({}); await ensureProfile({}); }}
							className="ml-4 px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
							type="button"
						>
							Tornar profissional (teste)
						</button>
					)}
				</div>
			</div>

			<div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
				<h3 className="text-lg font-semibold text-gray-900 mb-4">Gestão de conta</h3>
				<div className="space-y-4">
					<div className="flex justify-between items-center">
						<div>
							<h4 className="font-medium text-gray-900">Exportar dados</h4>
							<p className="text-sm text-gray-600">Obter uma cópia dos seus dados</p>
						</div>
						<button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
							Exportar
						</button>
					</div>
					<div className="flex justify-between items-center">
						<div>
							<h4 className="font-medium text-gray-900">Apagar conta</h4>
							<p className="text-sm text-gray-600">Eliminar conta e dados</p>
						</div>
						<button className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
							Apagar
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
