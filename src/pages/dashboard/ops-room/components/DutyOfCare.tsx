import { Shield } from 'lucide-react';

/**
 * Ce module affichait auparavant une liste d'agents de terrain fabriqués
 * (noms, statuts, dernier pointage inventés). Retiré tant qu'aucune table
 * Supabase réelle de suivi des agents n'existe. Ne jamais réintroduire de
 * personnel/coordonnées fictifs ici.
 */
export default function DutyOfCare() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Duty of Care — Protection Terrain
        </h3>
        <p className="text-[10px] text-gray-500 mt-0.5">Suivi des agents déployés sur le terrain</p>
      </div>

      <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-10 text-center">
        <Shield className="w-10 h-10 text-gray-700 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Module non configuré</p>
        <p className="text-[10px] text-gray-600 mt-1 max-w-sm mx-auto">
          Le suivi des agents de terrain n'est pas encore connecté à une source de données réelle.
          Aucun agent fictif n'est affiché ici en attendant l'intégration.
        </p>
      </div>
    </div>
  );
}
