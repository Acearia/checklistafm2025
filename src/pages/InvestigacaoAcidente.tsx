import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  PlusCircle,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import {
  listInvestigatorAccounts,
  verifyInvestigatorCredentials,
} from "@/lib/adminCredentials";
import { useNavigate } from "react-router-dom";

type MaoDeObra = "Direta" | "Indireta";
type TipoAcidente = "Tipico" | "Trajeto" | "Terceiros" | "Danos Morais" | "Ambiental";
type NaturezaOcorrencia = "Incidente" | "Acidente";
type Gravidade = "Minima" | "Mediana" | "Consideravel" | "Critica";
type Probabilidade = "Improvavel" | "Pouco Provavel" | "Provavel" | "Altamente Provavel";
type Turno = "1o" | "2o" | "3o" | "Geral";

interface InvestigacaoAcidenteForm {
  titulo: string;
  data_ocorrencia: string;
  hora: string;
  turno: Turno | "";
  nome_acidentado: string;
  cargo: string;
  setor: string;
  tempo_empresa: string;
  tempo_funcao: string;
  natureza_ocorrencia: NaturezaOcorrencia | "";
  mao_de_obra: MaoDeObra | "";
  tipo_acidente: TipoAcidente | "";
  teve_afastamento: boolean | null;
  dias_afastamento: string;
  gravidade: Gravidade | "";
  probabilidade: Probabilidade | "";
  parte_corpo_atingida: string;
  causa_raiz: string;
  agente_causador: string;
  causa_acidente: string;
  descricao_detalhada: string;
  observacoes: string;
  investigador: string;
}

interface AttachmentMeta {
  name: string;
  size: number;
  type: string;
}

interface InvestigacaoAcidenteRecord extends InvestigacaoAcidenteForm {
  numero_ocorrencia: number;
  id: string;
  created_at: string;
  teve_afastamento: boolean;
  attachments: AttachmentMeta[];
}

const STORAGE_KEY = "checklistafm-investigacoes-acidente";
const OCCURRENCE_COUNTER_KEY = "checklistafm-investigacao-ocorrencia-counter";
const CUSTOM_AGENTES_STORAGE_KEY = "checklistafm-investigacao-agentes-custom";
const CUSTOM_CAUSAS_STORAGE_KEY = "checklistafm-investigacao-causas-custom";

const DEFAULT_AGENTES_CAUSADORES = `
ATO INSEGURO
AÇÕES
USAR EQUIPAMENTO DE MANEIRA IMPRÓPRIA
Usar Material ou Equipamento Fora de Sua Finalidade
Sobrecarregar (AndaiMe, Veículo)
Usar Equipamento de Maneira Imprópria
NIC, Usar Equipamento de Maneira Imprópria
USAR EQUIPAMENTO INSEGURO
TORNAR INOPERANTE OU INEFICIENTE DISPOSITIVO DE SEGURANÇA
Desligar ou Remover Dispositivo de Segurança
Bloquear, Tampar, Amarrar, Dispositivo de Segurança
Desregular Dispositivo de Segurança
Substituir Dispositivo de Segurança por Outro
NIC, Tornar Inoperante ou Ineficiente Dispositivo Segurança
USAR MÃO OU PARTE DO CORPO IMPROPRIAMENTE
Manusear Objeto de Maneira Insegura
Manusear Objeto de Maneira Errada
Usar Mão em Vez de Ferramenta
NIC, Usar Mão ou Outra Parte do Corpo Impropriamente
ASSUMIR POSIÇÃO OU POSTURA INSEGURA
Entrar em Tanque, Silo ou Outro Compartimento Confinado
Expor-se Desnecessariamente ao Alcance de Objeto ou
Expor-se Desnecessariamente, à Carga Suspensa ou Oscilante
Movimentar Carga de Maneira Imprópria
Transportar em Posição Insegura
NIC, Assumir Posição ou Postura Insegura
TRABALHAR OU OPERAR EM VELOCIDADE INSEGURA
Correr
Operar com Velocidade Insegura
Abastecer Depressa Demais
Saltar de Ponto Elevado de Veículo, de Plataforma
Jogar Objeto em Vez de Carregá-lo ou Passá-lo
NIC, Trabalhar ou Operar em Velocidade Insegura
LIMPAR, LUBRIFICAR, REGULAR OU CONSERTAR EQUIPAMENTO EM
Limpar, Lubrificar ou Regular Equipamento em Movimento
Trabalhar em Equipamento Elétrico Energizado
Calefatar ou Vedar Equipamento Sob Pressão
Soldar, Consertar Tanque, Recipiente ou Equipamento Sem
NIC, Limpar, Lubrificar, Regular ou Consertar Equipamento
COLOCAR, MISTURAR DE MANEIRA INSEGURA
Colocar Material, Ferramenta, Sucata, de Maneira Insegura
Colocar de Maneira Insegura Veículo ou Equipamento
Misturar ou Injetar Substância de Modo a Criar Risco de
NIC, Colocar, Misturar, de Maneira Insegura
FAZER BRINCADEIRA OU EXIBIÇÃO
AGREDIR PESSOAS
DIRIGIR INCORRETAMENTE
Dirigir em Velocidade Inadequada (Alta ou Baixa)
Não Manter Distância
Ultrapassar Ilegalmente
Entrar ou Sair de Veículo do Lado do Trânsito
Desrespeitar a Sinalização de Trânsito
Desrespeitar Regras Preferenciais
Não Sinalizar Para Parar, Dobrar ou Dar Marcha Ré
Dobrar Irregularmente
NIC, Dirigir Incorretamente
OMISSÕES
DEIXAR DE USAR VESTIMENTA SEGURA
DEIXAR DE USAR EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL DISPONÍVEL
Óculos
Luvas
Máscara
Capacete
Calçado
Avental
Cinto de Segurança
Protetor Auditivo
NIC, Deixar de Usar o Equipamento de Proteção Individual
DEIXAR DE PRENDER, DESLIGAR OU DE SINALIZAR
Deixar de Desligar Equipamento que Não Esteja Sendo Usado
Deixar de Trancar, Bloquear ou Prender Veículo,
Deixar de Colocar Cartaz, Aviso, Etiqueta de Advertência
Deixar de Sinalizar ao Soltar ou Movimentar Carga
Deixar de Sinalizar ao Dar Partida ou Parar
NIC, Deixar de Prender, de Desligar ou de Sinalizar
DEIXAR DE VERIFICAR A AUSÊNCIA DE TENSÃO EM EQUIP. ELÉTRICO
DEIXAR DE ATERRAR
DESCUIDAR-SE NA OBSERVAÇÃO DO AMBIENTE
NIC, ATO INSEGURO
ATO INSEGURO INEXISTENTE
CONDIÇÃO INSEGURA
RISCO RELATIVO AO AMBIENTE
PROBLEMAS COM ESPAÇO E CIRCULAÇÃO
Insuficiência de Espaço Para o Trabalho
Insuficiência de Espaço p/ Movimentação de Objetos e Pessoas
Passagem e Saída Inadequada por Motivos Outros que não a
Controle Inadequado de Trânsito
NIC, Problemas de Espaço e Circulação
EXISTÊNCIA DE RUÍDO
EXISTÊNCIA DE VIBRAÇÃO
ILUMINAÇÃO INADEQUADA
ORDEM E LIMPEZA INADEQUADA
NIC, Risco Relativo ao Ambiente
DEFEITO DE AGENTE
MAL PROJETADO
MAL CONSTITUÍDO, CONSTRUÍDO OU MONTADO
CONSTITUÍDO POR MATERIAL INADEQUADO
ÁSPERO
ESCORREGADIO
NÃO AFIADO
PONTIAGUDO, CORTANTE
GASTO, RACHADO, ESGARÇADO, QUEBRADO
NIC, Defeito do Agente
COLOCAÇÃO PERIGOSA
POSIÇÃO INADEQUADA
EMPILHAMENTO INADEQUADO
MÁ FIXAÇÃO CONTRA MOVIMENTO INDESEJÁVEL
NIC, Colocação Perigosa
PROTEÇÃO COLETIVA INADEQUADA OU INEXISTENTE
SEM PROTEÇÃO (EXCETUADOS OS RISCOS ELÉTRICOS E DE RADIAÇÃO)
COM PROTEÇÃO INADEQUADA
FALTA DE ESCORAMENTO OU ESCORAMENTO INADEQUADO EM
NÃO ELETRICAMENTE ATERRADO
NÃO ELÉTRICAMENTE ISOLADO
CONEXÃO ELÉTRICA, CHAVES ELÉTRICAS DESCOBERTAS
EQUIPAMENTO ELÉTRICO SEM IDENTIFICAÇÃO OU
SEM BLINDAGEM PARA RADIAÇÃO
COM BLINDAGEM INADEQUADA PARA RADIAÇÃO
MATERIAL RADIOATIVO SEM IDENTIFICAÇÃO OU
NIC, Proteção Coletiva Inadequada ou Inexistente
MÉTODO OU PROCEDIMENTO ARRISCADO
USO DE MATERIAL OU EQUIPAMENTO POTENCIALMENTE PERIGOSO
EMPREGO DE FERRAMENTA OU EQUIPAMENTO INADEQUADO OU IMPRÓPRIO
EMPREGO DE MÉTODO OU PROCEDIMENTO POTENCIALMENTE PERIGOSO
ESCOLHA IMPRÓPRIA DE PESSOAL
AJUDA INADEQUADA EM CASO DE LEVANTAMENTO DE OBJETO PESADO
NIC, Método ou Procedimento Arriscado
RISCO RELATIVO AO VESTIÁRIO OU EQUIP. PROTEÇÃO INDIVIDUAL
FALTA DO ADEQUADO EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL
VESTUÁRIO IMPRÓPRIO OU INADEQUADO
NIC, Risco Relativo ao Vestiário ou EPI
RISCO INERENTE A AMBIENTE DE TRABALHO EXTERNO
RISCO INERENTE A DEPENDÊNCIAS INSEGURAS DE TERCEIROS
RISCO INERENTE A MATERIAL OU EQUIP. INSEGURO DE TERCEIROS
OUTROS RISCOS RELACIONADOS COM A PROPRIEDADE OU
RISCO DE NATUREZA
NIC, Risco Inerente a Ambiente de Trabalho Externo
RISCO RELACIONADO COM AMBIENTE PÚBLICO
RISCO RELACIONADO COM O TRANSPORTE PÚBLICO
RISCO RELACIONADO COM O TRÂNSITO
NIC, Risco Relacionado com Ambiente Público
NIC, Condição Insegura
CONDIÇÃO INSEGURA INEXISTENTE
FATOR PESSOAL DE INSEGURANÇA
FALTA DE CONHECIMENTO OU EXPERIÊNCIA
FALTA DE CONHECIMENTO
FALTA DE EXPERIÊNCIA OU ESPECIALIZAÇÃO
DESAJUSTAMENTO FÍSICO
Deformidade
Hérnia Preexistente
Debilidade Muscular
Debilidade Esquelética
Debilidade Orgânica
Deficiência Visual
Deficiência Auditiva
Deficiência Olfativa
Doença Degenerativa
Insensibilidade Cutânea
Fadiga
NIC, Desajustamento Físico
DESAJUSTAMENTO EMOCIONAL OU MENTAL
Alcoolismo e Toxicomania
Agressividade
Excitabilidade, Impulsividade
Alienação Mental (Loucura)
Distúrbio Emocional
Distúrbio Cerebral, Ausência
Deficiência Intelectual
NIC, Desajustamento Emocional ou Mental
NIC, Fator Pessoal
FATOR PESSOAL INEXISTENTE
`.trim().split("\n").map((item) => item.trim()).filter(Boolean);

const DEFAULT_CAUSAS_ACIDENTE = [...DEFAULT_AGENTES_CAUSADORES];
const TURNO_OPTIONS: Turno[] = ["1o", "2o", "3o", "Geral"];

const DEFAULT_PARTES_CORPO_ATINGIDA = `
LOCALIZACAO DA LESAO
CABECA
COURO CABELUDO
Cranio (inclusive encefalo)
Ouvido (externo, medio, interno, audicao e equilibrio)
Pavilhao da orelha
Ouvido externo
Ouvido medio
Ouvido interno
FACE
Testa
Supercilio
Olho (inclusive nervo optico e visao)
Nariz (inclusive fossas nasais, seios da face e olfato)
Boca (inclusive labios, dentes, lingua, garganta e paladar)
Mandibula (inclusive queixo)
Face, partes multiplas
Cabeca, parte multiplas
Cabeca, NIC
Pescoco
MEMBROS SUPERIORES
Braco (entre o punho e o ombro)
Braco (acima do cotovelo)
Cotovelo
Antebraco (entre o punho e o cotovelo)
Punho
Mao (exceto punho ou dedos)
Dedo
Membros superiores, parte multiplas
Membros superiores, NIC
Tronco
Ombro
Torax (inclusive orgaos internos)
Dorso (inclusive musculos dorsais, coluna e medula espinhal)
Abdome (inclusive orgaos internos)
Quadris (inclusive pelvis, orgaos, pelvicos e nadegas)
GENITALIA
Tronco, partes multiplas
NIC, Tronco
MEMBROS INFERIORES
Perna (entre o tornozelo e a pelvis)
Coxa
Joelho
Perna (do tornozelo, exclusive, ao joelho, exclusive)
Articulacao do tornozelo
Pe (exceto artelhos)
Artelho
Membros inferiores, partes multiplas
Membros inferiores, NIC
Partes multiplas
Sistemas e aparelhos
Aparelho circulatorio
SISTEMA LINFATICO
Aparelho respiratorio
Sistema nervoso
Aparelho digestivo
Aparelho genito-urinario
Sistema musculoesqueletico
Sistema e aparelhos, NIC
Localizacao da lesao, NIC
LOCALIZACAO DA LESAO INEXISTENTE
`.trim().split("\n").map((item) => item.trim()).filter(Boolean);

const decodePotentialMojibake = (value: string) => {
  const cp1252ReverseMap: Record<number, number> = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
  };

  const fixReplacementChars = (input: string) =>
    input
      .replace(/EXPEDI\uFFFD+\s*O/gi, "EXPEDIÇÃO")
      .replace(/N\uFFFDO/gi, "NÃO")
      .replace(/\uFFFD+/g, "");

  const hasMojibake = /[ÃÂ]/.test(value);
  const hasReplacement = /\uFFFD/.test(value);
  if (!hasMojibake && !hasReplacement) return value;

  if (!hasMojibake) {
    return fixReplacementChars(value);
  }

  try {
    const bytes = Uint8Array.from(
      Array.from(value, (char) => {
        const codePoint = char.charCodeAt(0);
        if (codePoint <= 0xff) return codePoint;
        return cp1252ReverseMap[codePoint] ?? 0x3f;
      }),
    );
    const decoded = new TextDecoder("utf-8").decode(bytes);
    return fixReplacementChars(decoded);
  } catch {
    return fixReplacementChars(value);
  }
};

const normalizeCause = (value: string) =>
  decodePotentialMojibake(value).trim().replace(/\s+/g, " ");

const dedupeCausas = (values: string[]) => {
  const unique = new Map<string, string>();
  values.forEach((value) => {
    const normalized = normalizeCause(value);
    if (!normalized) return;
    const key = normalized.toLocaleLowerCase("pt-BR");
    if (!unique.has(key)) {
      unique.set(key, normalized);
    }
  });
  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
};

const REQUIRED_TEXT_FIELDS: Array<keyof InvestigacaoAcidenteForm> = [
  "titulo",
  "data_ocorrencia",
  "hora",
  "turno",
  "nome_acidentado",
  "cargo",
  "setor",
  "tempo_empresa",
  "tempo_funcao",
  "parte_corpo_atingida",
  "causa_raiz",
  "agente_causador",
  "causa_acidente",
  "descricao_detalhada",
  "observacoes",
  "investigador",
];

const INITIAL_FORM: InvestigacaoAcidenteForm = {
  titulo: "",
  data_ocorrencia: "",
  hora: "",
  turno: "",
  nome_acidentado: "",
  cargo: "",
  setor: "",
  tempo_empresa: "",
  tempo_funcao: "",
  natureza_ocorrencia: "",
  mao_de_obra: "",
  tipo_acidente: "",
  teve_afastamento: null,
  dias_afastamento: "",
  gravidade: "",
  probabilidade: "",
  parte_corpo_atingida: "",
  causa_raiz: "",
  agente_causador: "",
  causa_acidente: "",
  descricao_detalhada: "",
  observacoes: "",
  investigador: "",
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
};

const formatDataResumo = (dateValue: string) => {
  if (!dateValue) return "N/A";
  const parts = dateValue.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatTurnoResumo = (turno: string) => {
  if (turno === "1o") return "1°";
  if (turno === "2o") return "2°";
  if (turno === "3o") return "3°";
  if (turno === "Geral") return "Geral";
  return turno || "N/A";
};

const parseNumeroOcorrencia = (value: unknown) => {
  const numero = Number(value);
  if (!Number.isFinite(numero) || numero < 0) return null;
  return Math.floor(numero);
};

const formatNumeroOcorrencia = (value: number) => String(value).padStart(3, "0");

const getNextNumeroOcorrencia = (records: InvestigacaoAcidenteRecord[]) => {
  const counterStorage = parseNumeroOcorrencia(localStorage.getItem(OCCURRENCE_COUNTER_KEY));

  let maxFromRecords = 0;
  let hasNumeroInRecords = false;
  records.forEach((record) => {
    const current = parseNumeroOcorrencia((record as { numero_ocorrencia?: unknown }).numero_ocorrencia);
    if (current === null) return;
    hasNumeroInRecords = true;
    if (current > maxFromRecords) {
      maxFromRecords = current;
    }
  });

  const fallbackFromLength = hasNumeroInRecords ? 0 : records.length;

  if (counterStorage === null && maxFromRecords === 0 && fallbackFromLength === 0) {
    localStorage.setItem(OCCURRENCE_COUNTER_KEY, "0");
    return 0;
  }

  const lastUsed = Math.max(counterStorage ?? 0, maxFromRecords, fallbackFromLength);
  const next = lastUsed + 1;
  localStorage.setItem(OCCURRENCE_COUNTER_KEY, String(next));
  return next;
};

const InvestigacaoAcidente = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sectors, operators, refresh } = useSupabaseData(["sectors", "operators"]);
  const [form, setForm] = useState<InvestigacaoAcidenteForm>(INITIAL_FORM);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [colaboradorDialogOpen, setColaboradorDialogOpen] = useState(false);
  const [investigators, setInvestigators] = useState<Array<{ username: string }>>([]);
  const [selectedInvestigator, setSelectedInvestigator] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [loadingInvestigators, setLoadingInvestigators] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappResumo, setWhatsappResumo] = useState("");
  const [isSavingColaborador, setIsSavingColaborador] = useState(false);
  const [novoColaboradorMatricula, setNovoColaboradorMatricula] = useState("");
  const [novoColaboradorNome, setNovoColaboradorNome] = useState("");
  const [novoColaboradorCargo, setNovoColaboradorCargo] = useState("");
  const [novoColaboradorSetor, setNovoColaboradorSetor] = useState("");
  const [novoColaboradorSenha, setNovoColaboradorSenha] = useState("");
  const [agentesCustomizados, setAgentesCustomizados] = useState<string[]>([]);
  const [causasCustomizadas, setCausasCustomizadas] = useState<string[]>([]);
  const [agenteDialogOpen, setAgenteDialogOpen] = useState(false);
  const [causaDialogOpen, setCausaDialogOpen] = useState(false);
  const [novoAgente, setNovoAgente] = useState("");
  const [novaCausa, setNovaCausa] = useState("");

  const agentesCausadores = useMemo(
    () => dedupeCausas([...DEFAULT_AGENTES_CAUSADORES, ...agentesCustomizados]),
    [agentesCustomizados],
  );
  const causasAcidente = useMemo(
    () => dedupeCausas([...DEFAULT_CAUSAS_ACIDENTE, ...causasCustomizadas]),
    [causasCustomizadas],
  );
  const setoresDisponiveis = useMemo(() => {
    const names = (sectors || [])
      .map((sector) => String((sector as { name?: string }).name ?? "").trim())
      .filter((name) => Boolean(name));
    return dedupeCausas(names);
  }, [sectors]);
  const operadoresDisponiveis = useMemo(() => {
    const uniqueByName = new Map<
      string,
      { name: string; matricula: string; cargo: string; setor: string }
    >();

    (operators || []).forEach((operator) => {
      const name = String((operator as { name?: string }).name ?? "").trim();
      if (!name) return;

      const key = name.toLocaleLowerCase("pt-BR");
      if (uniqueByName.has(key)) return;

      uniqueByName.set(key, {
        name,
        matricula: String((operator as { matricula?: string }).matricula ?? "").trim(),
        cargo: String((operator as { cargo?: string | null }).cargo ?? "").trim(),
        setor: String((operator as { setor?: string | null }).setor ?? "").trim(),
      });
    });

    return Array.from(uniqueByName.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [operators]);

  const updateField = <K extends keyof InvestigacaoAcidenteForm>(
    field: K,
    value: InvestigacaoAcidenteForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNomeAcidentadoChange = (value: string) => {
    const normalized = value.trim().toLocaleLowerCase("pt-BR");
    const matchedOperator = operadoresDisponiveis.find(
      (operator) => operator.name.toLocaleLowerCase("pt-BR") === normalized,
    );

    setForm((prev) => ({
      ...prev,
      nome_acidentado: value,
      cargo: prev.cargo || matchedOperator?.cargo || prev.cargo,
      setor: prev.setor || matchedOperator?.setor || prev.setor,
    }));
  };

  const handleColaboradorDialogChange = (open: boolean) => {
    setColaboradorDialogOpen(open);
    if (!open) {
      setNovoColaboradorMatricula("");
      setNovoColaboradorNome("");
      setNovoColaboradorCargo("");
      setNovoColaboradorSetor("");
      setNovoColaboradorSenha("");
    }
  };

  const handleOpenColaboradorDialog = () => {
    setNovoColaboradorNome(form.nome_acidentado || "");
    setNovoColaboradorCargo(form.cargo || "");
    setNovoColaboradorSetor(form.setor || "");
    setNovoColaboradorSenha("");
    setColaboradorDialogOpen(true);
  };

  const handleSalvarNovoColaborador = async () => {
    const matricula = novoColaboradorMatricula.trim();
    const nome = novoColaboradorNome.trim();
    const cargo = novoColaboradorCargo.trim();
    const setor = novoColaboradorSetor.trim();
    const senha = novoColaboradorSenha.trim();

    if (!/^\d{4}$/.test(matricula)) {
      toast({
        title: "Matricula invalida",
        description: "Informe uma matricula com 4 digitos.",
        variant: "destructive",
      });
      return;
    }

    if (nome.length < 2) {
      toast({
        title: "Nome invalido",
        description: "Informe o nome do colaborador.",
        variant: "destructive",
      });
      return;
    }

    if (senha && !/^\d{4}$/.test(senha)) {
      toast({
        title: "Senha invalida",
        description: "A senha inicial deve ter 4 digitos numericos.",
        variant: "destructive",
      });
      return;
    }

    const matriculaJaExiste = (operators || []).some(
      (operator) =>
        String((operator as { matricula?: string }).matricula ?? "").trim() === matricula,
    );

    if (matriculaJaExiste) {
      toast({
        title: "Matricula ja cadastrada",
        description: "Ja existe um operador com esta matricula.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSavingColaborador(true);
      const { operatorService } = await import("@/lib/supabase-service");
      await operatorService.create({
        matricula,
        name: nome,
        cargo: cargo || null,
        setor: setor || null,
        senha: senha || null,
      });

      await refresh();

      setForm((prev) => ({
        ...prev,
        nome_acidentado: nome,
        cargo: cargo || prev.cargo,
        setor: setor || prev.setor,
      }));

      toast({
        title: "Colaborador adicionado",
        description: "Colaborador salvo na lista de operadores/colaboradores com sucesso.",
      });

      handleColaboradorDialogChange(false);
    } catch (error) {
      console.error("Erro ao adicionar colaborador:", error);
      toast({
        title: "Erro ao adicionar",
        description: "Nao foi possivel salvar o colaborador nos operadores.",
        variant: "destructive",
      });
    } finally {
      setIsSavingColaborador(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const parseFromStorage = (key: string) => {
        const raw = localStorage.getItem(key);
        if (!raw) return [] as string[];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [] as string[];
        return parsed
          .map((item) => normalizeCause(String(item ?? "")))
          .filter((item) => Boolean(item));
      };

      setAgentesCustomizados(dedupeCausas(parseFromStorage(CUSTOM_AGENTES_STORAGE_KEY)));
      setCausasCustomizadas(dedupeCausas(parseFromStorage(CUSTOM_CAUSAS_STORAGE_KEY)));
    } catch (error) {
      console.error("Erro ao carregar listas customizadas:", error);
    }
  }, []);

  const loadInvestigators = async () => {
    setLoadingInvestigators(true);
    try {
      const data = await listInvestigatorAccounts();
      setInvestigators(data.map((item) => ({ username: item.username })));
    } catch (error) {
      console.error("Erro ao carregar investigadores:", error);
      setInvestigators([]);
    } finally {
      setLoadingInvestigators(false);
    }
  };

  useEffect(() => {
    void loadInvestigators();
  }, []);

  const handleSignDialogChange = (open: boolean) => {
    setSignDialogOpen(open);
    if (!open) {
      setAuthPassword("");
    }
  };

  const handleWhatsappDialogChange = (open: boolean) => {
    setWhatsappDialogOpen(open);
    if (!open) {
      navigate("/");
    }
  };

  const handleOpenWhatsapp = () => {
    if (!whatsappResumo.trim()) {
      toast({
        title: "Resumo vazio",
        description: "Nao foi possivel montar o resumo para envio no WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappResumo)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyWhatsappResumo = async () => {
    if (!whatsappResumo.trim()) return;
    try {
      await navigator.clipboard.writeText(whatsappResumo);
      toast({
        title: "Resumo copiado",
        description: "Agora e so colar no grupo geral da seguranca.",
      });
    } catch (error) {
      console.error("Erro ao copiar resumo do WhatsApp:", error);
      toast({
        title: "Nao foi possivel copiar",
        description: "Copie o texto manualmente no resumo exibido.",
        variant: "destructive",
      });
    }
  };

  const handleOpenSignDialog = async () => {
    if (!investigators.length) {
      await loadInvestigators();
    }
    setSelectedInvestigator((prev) => prev || form.investigador);
    setAuthPassword("");
    setSignDialogOpen(true);
  };

  const requiredTextFilledCount = useMemo(
    () => REQUIRED_TEXT_FIELDS.filter((field) => String(form[field] ?? "").trim()).length,
    [form],
  );

  const isClassificationComplete = Boolean(
    form.natureza_ocorrencia && form.mao_de_obra && form.tipo_acidente,
  );
  const hasAfastamentoSelection = form.teve_afastamento !== null;
  const isRiskComplete = Boolean(form.gravidade && form.probabilidade);
  const isAfastamentoComplete =
    hasAfastamentoSelection &&
    (form.teve_afastamento !== true ||
      (Boolean(form.dias_afastamento.trim()) && Number(form.dias_afastamento) > 0));
  const isSigned = Boolean(form.investigador.trim());
  const hasAttachments = attachments.length > 0;

  const completionChecks = [
    requiredTextFilledCount === REQUIRED_TEXT_FIELDS.length,
    isClassificationComplete,
    isRiskComplete,
    isAfastamentoComplete,
    isSigned,
    hasAttachments,
  ];

  const completionPercent = Math.round(
    (completionChecks.filter(Boolean).length / completionChecks.length) * 100,
  );

  const nextPendingHint = useMemo(() => {
    if (requiredTextFilledCount !== REQUIRED_TEXT_FIELDS.length) {
      return "Preencha os campos obrigatorios de texto.";
    }
    if (!isClassificationComplete) {
      return "Complete a classificacao do acidente.";
    }
    if (!isRiskComplete) {
      return "Complete a analise de risco.";
    }
    if (!hasAfastamentoSelection) {
      return "Informe se houve afastamento.";
    }
    if (!isAfastamentoComplete) {
      return "Informe dias validos no afastamento.";
    }
    if (!isSigned) {
      return "Assine o checklist com usuario e senha.";
    }
    if (!hasAttachments) {
      return "Anexe ao menos um arquivo.";
    }
    return null;
  }, [
    hasAttachments,
    hasAfastamentoSelection,
    isAfastamentoComplete,
    isClassificationComplete,
    isRiskComplete,
    isSigned,
    requiredTextFilledCount,
  ]);

  const validateForm = (): string | null => {
    for (const field of REQUIRED_TEXT_FIELDS) {
      if (!String(form[field] ?? "").trim()) {
        return "Preencha todos os campos obrigatorios antes de enviar.";
      }
    }

    if (
      !form.natureza_ocorrencia ||
      !form.mao_de_obra ||
      !form.tipo_acidente ||
      !form.gravidade ||
      !form.probabilidade
    ) {
      return "Preencha todos os campos de classificacao e analise de risco.";
    }

    if (form.teve_afastamento === null) {
      return "Informe se houve afastamento.";
    }

    if (form.teve_afastamento === true) {
      const dias = Number(form.dias_afastamento);
      if (!form.dias_afastamento.trim() || Number.isNaN(dias) || dias <= 0) {
        return "Informe os dias de afastamento quando houver afastamento.";
      }
    }

    if (attachments.length === 0) {
      return "Anexe ao menos um arquivo antes de enviar.";
    }

    return null;
  };

  const handleSignChecklist = async () => {
    if (!selectedInvestigator.trim()) {
      toast({
        title: "Investigador obrigatorio",
        description: "Selecione o investigador para assinar.",
        variant: "destructive",
      });
      return;
    }

    if (!authPassword.trim()) {
      toast({
        title: "Senha obrigatoria",
        description: "Informe a senha para assinar o checklist.",
        variant: "destructive",
      });
      return;
    }

    setIsSigning(true);
    try {
      const auth = await verifyInvestigatorCredentials(selectedInvestigator.trim(), authPassword);
      if (!auth) {
        toast({
          title: "Falha na assinatura",
          description: "Usuario ou senha de investigador invalidos.",
          variant: "destructive",
        });
        return;
      }

      updateField("investigador", auth.username);
      setSelectedInvestigator(auth.username);
      handleSignDialogChange(false);

      toast({
        title: "Checklist assinado",
        description: `Investigador definido como ${auth.username}.`,
      });
    } catch (error) {
      console.error("Erro ao assinar checklist:", error);
      toast({
        title: "Erro",
        description: "Nao foi possivel validar a assinatura no momento.",
        variant: "destructive",
      });
    } finally {
      setIsSigning(false);
    }
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleAgenteDialogChange = (open: boolean) => {
    setAgenteDialogOpen(open);
    if (!open) {
      setNovoAgente("");
    }
  };

  const handleAdicionarNovoAgente = () => {
    const agenteNormalizado = normalizeCause(novoAgente);
    if (!agenteNormalizado) {
      toast({
        title: "Novo agente vazio",
        description: "Informe uma descrição válida para adicionar.",
        variant: "destructive",
      });
      return;
    }

    const agenteExistente = agentesCausadores.find(
      (item) => item.toLocaleLowerCase("pt-BR") === agenteNormalizado.toLocaleLowerCase("pt-BR"),
    );

    if (agenteExistente) {
      updateField("agente_causador", agenteExistente);
      toast({
        title: "Agente já existente",
        description: "O agente informado já estava na lista e foi selecionado.",
      });
      handleAgenteDialogChange(false);
      return;
    }

    const atualizada = dedupeCausas([...agentesCustomizados, agenteNormalizado]);
    setAgentesCustomizados(atualizada);
    updateField("agente_causador", agenteNormalizado);

    try {
      localStorage.setItem(CUSTOM_AGENTES_STORAGE_KEY, JSON.stringify(atualizada));
    } catch (error) {
      console.error("Erro ao salvar agente customizado:", error);
    }

    toast({
      title: "Novo agente adicionado",
      description: "O agente foi adicionado com sucesso e selecionado no formulário.",
    });
    handleAgenteDialogChange(false);
  };

  const handleCausaDialogChange = (open: boolean) => {
    setCausaDialogOpen(open);
    if (!open) {
      setNovaCausa("");
    }
  };

  const handleAdicionarNovaCausa = () => {
    const causaNormalizada = normalizeCause(novaCausa);
    if (!causaNormalizada) {
      toast({
        title: "Nova causa vazia",
        description: "Informe uma descrição válida para adicionar.",
        variant: "destructive",
      });
      return;
    }

    const causaExistente = causasAcidente.find(
      (item) => item.toLocaleLowerCase("pt-BR") === causaNormalizada.toLocaleLowerCase("pt-BR"),
    );

    if (causaExistente) {
      updateField("causa_acidente", causaExistente);
      toast({
        title: "Causa já existente",
        description: "A causa informada já estava na lista e foi selecionada.",
      });
      handleCausaDialogChange(false);
      return;
    }

    const atualizada = dedupeCausas([...causasCustomizadas, causaNormalizada]);
    setCausasCustomizadas(atualizada);
    updateField("causa_acidente", causaNormalizada);

    try {
      localStorage.setItem(CUSTOM_CAUSAS_STORAGE_KEY, JSON.stringify(atualizada));
    } catch (error) {
      console.error("Erro ao salvar causa customizada:", error);
    }

    toast({
      title: "Nova causa adicionada",
      description: "A causa foi adicionada com sucesso e selecionada no formulário.",
    });
    handleCausaDialogChange(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Formulario incompleto",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const existingRecords = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]",
      ) as InvestigacaoAcidenteRecord[];

      const ocorrenciaNumero = getNextNumeroOcorrencia(existingRecords);
      const nomeNormalizado = form.nome_acidentado.trim().toLocaleLowerCase("pt-BR");
      const operadorAcidentado = operadoresDisponiveis.find(
        (operator) => operator.name.toLocaleLowerCase("pt-BR") === nomeNormalizado,
      );
      const matriculaAcidentado = operadorAcidentado?.matricula || "Nao informada";
      const classificacaoFinal = form.natureza_ocorrencia
        ? `${form.natureza_ocorrencia} ${form.teve_afastamento ? "com afastamento" : "sem afastamento"}!`
        : "Nao informada";

      const resumoWhatsapp = [
        "🚨 Comunicado de Ocorrência 🚨",
        `Ocorrência: ${formatNumeroOcorrencia(ocorrenciaNumero)}`,
        `Turno: ${formatTurnoResumo(form.turno)}`,
        `Horário: ${form.hora || "N/A"}`,
        `Data: ${formatDataResumo(form.data_ocorrencia)}`,
        `Matrícula: ${matriculaAcidentado}`,
        `Nome: ${form.nome_acidentado || "N/A"}`,
        form.descricao_detalhada || "Sem descricao detalhada.",
        `Classificação: ${classificacaoFinal}`,
      ].join("\n");

      const payload: InvestigacaoAcidenteRecord = {
        ...form,
        numero_ocorrencia: ocorrenciaNumero,
        teve_afastamento: form.teve_afastamento === true,
        dias_afastamento: form.teve_afastamento === true ? form.dias_afastamento : "",
        id:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : Date.now().toString(),
        created_at: new Date().toISOString(),
        attachments: attachments.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      };

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([payload, ...existingRecords]),
      );

      window.dispatchEvent(new Event("checklistafm-investigacao-acidente-updated"));

      toast({
        title: "Investigacao enviada",
        description: "Registro salvo com sucesso.",
      });

      setWhatsappResumo(resumoWhatsapp);
      setWhatsappDialogOpen(true);

      setForm(INITIAL_FORM);
      setAttachments([]);
      setSelectedInvestigator("");
      setAuthPassword("");
    } catch (error) {
      console.error("Erro ao salvar investigacao:", error);
      toast({
        title: "Erro ao salvar",
        description: "Nao foi possivel enviar a investigacao. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12">
      <Card className="border-red-100 bg-gradient-to-br from-white via-white to-red-50/40">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-red-700 p-2 text-white">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl">Investigacao de Acidente</CardTitle>
              <CardDescription>
                Preencha os dados da ocorrencia, valide a assinatura e envie o registro.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-3">
            <Badge variant={isSigned ? "default" : "secondary"} className="justify-center">
              {isSigned ? `Assinado: ${form.investigador}` : "Assinatura pendente"}
            </Badge>
            <Badge variant={hasAttachments ? "default" : "secondary"} className="justify-center">
              {hasAttachments ? `${attachments.length} anexo(s)` : "Sem anexos"}
            </Badge>
            <Badge variant="outline" className="justify-center">
              {requiredTextFilledCount}/{REQUIRED_TEXT_FIELDS.length} campos obrigatorios
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Progresso de preenchimento</span>
              <span>{completionPercent}%</span>
            </div>
            <Progress value={completionPercent} className="h-2" />
          </div>

          {nextPendingHint ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{nextPendingHint}</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Formulario pronto para envio.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <form id="investigacao-acidente-form" onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-red-700" />
              Cabecalho
            </CardTitle>
            <CardDescription>Dados basicos da ocorrencia.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="titulo">Titulo *</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(e) => updateField("titulo", e.target.value)}
                placeholder="Ex: Queda durante movimentacao de material"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_ocorrencia">Data da ocorrencia *</Label>
              <Input
                id="data_ocorrencia"
                type="date"
                value={form.data_ocorrencia}
                onChange={(e) => updateField("data_ocorrencia", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora">Hora *</Label>
              <Input
                id="hora"
                type="time"
                value={form.hora}
                onChange={(e) => updateField("hora", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Turno *</Label>
              <Select
                value={form.turno || undefined}
                onValueChange={(value) => updateField("turno", value as Turno)}
              >
                <SelectTrigger id="turno">
                  <SelectValue placeholder="Selecione o turno" />
                </SelectTrigger>
                <SelectContent>
                  {TURNO_OPTIONS.map((turno) => (
                    <SelectItem key={turno} value={turno}>
                      {turno}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identificacao do Acidentado</CardTitle>
            <CardDescription>Informacoes do colaborador envolvido.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="nome_acidentado">Colaborador acidentado *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={handleOpenColaboradorDialog}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Adicionar colaborador
                </Button>
              </div>
              <Input
                id="nome_acidentado"
                list="operadores-acidentado-list"
                value={form.nome_acidentado}
                onChange={(e) => handleNomeAcidentadoChange(e.target.value)}
                placeholder="Selecione dos operadores ou digite manualmente"
              />
              <datalist id="operadores-acidentado-list">
                {operadoresDisponiveis.map((operator) => (
                  <option
                    key={`${operator.name}-${operator.matricula || "sem-matricula"}`}
                    value={operator.name}
                    label={
                      operator.matricula
                        ? `${operator.name} - ${operator.matricula}`
                        : operator.name
                    }
                  />
                ))}
              </datalist>
              <p className="text-xs text-gray-500">
                {operadoresDisponiveis.length > 0
                  ? "Sugestoes carregadas da tabela de operadores. Tambem e possivel digitar manualmente."
                  : "Sem operadores disponiveis no banco. Digite manualmente o colaborador acidentado."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo *</Label>
              <Input
                id="cargo"
                value={form.cargo}
                onChange={(e) => updateField("cargo", e.target.value)}
                placeholder="Ex: Operador de ponte rolante"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setor">Setor *</Label>
              {setoresDisponiveis.length > 0 ? (
                <Select
                  value={form.setor || undefined}
                  onValueChange={(value) => updateField("setor", value)}
                >
                  <SelectTrigger id="setor">
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {setoresDisponiveis.map((setor) => (
                      <SelectItem key={setor} value={setor}>
                        {setor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="setor"
                  value={form.setor}
                  onChange={(e) => updateField("setor", e.target.value)}
                  placeholder="Nenhum setor encontrado no banco"
                />
              )}
              {setoresDisponiveis.length === 0 && (
                <p className="text-xs text-amber-600">
                  Nenhum setor cadastrado na tabela de setores. Cadastre no administrativo.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tempo_empresa">Tempo de empresa *</Label>
              <Input
                id="tempo_empresa"
                value={form.tempo_empresa}
                onChange={(e) => updateField("tempo_empresa", e.target.value)}
                placeholder="Ex: 3 anos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tempo_funcao">Tempo na funcao *</Label>
              <Input
                id="tempo_funcao"
                value={form.tempo_funcao}
                onChange={(e) => updateField("tempo_funcao", e.target.value)}
                placeholder="Ex: 8 meses"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classificacao</CardTitle>
            <CardDescription>Caracteristicas do acidente e afastamento.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Incidente ou acidente *</Label>
              <Select
                value={form.natureza_ocorrencia || undefined}
                onValueChange={(value) =>
                  updateField("natureza_ocorrencia", value as NaturezaOcorrencia)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incidente">Incidente</SelectItem>
                  <SelectItem value="Acidente">Acidente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mao de obra *</Label>
              <Select
                value={form.mao_de_obra || undefined}
                onValueChange={(value) => updateField("mao_de_obra", value as MaoDeObra)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Direta">Direta</SelectItem>
                  <SelectItem value="Indireta">Indireta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de acidente *</Label>
              <Select
                value={form.tipo_acidente || undefined}
                onValueChange={(value) => updateField("tipo_acidente", value as TipoAcidente)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tipico">Tipico</SelectItem>
                  <SelectItem value="Trajeto">Trajeto</SelectItem>
                  <SelectItem value="Terceiros">Terceiros</SelectItem>
                  <SelectItem value="Danos Morais">Danos Morais</SelectItem>
                  <SelectItem value="Ambiental">Ambiental</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Afastamento *</Label>
              <Select
                value={
                  form.teve_afastamento === null
                    ? undefined
                    : form.teve_afastamento
                      ? "sim"
                      : "nao"
                }
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    teve_afastamento: value === "sim",
                    dias_afastamento: value === "sim" ? prev.dias_afastamento : "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Nao</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.teve_afastamento === true && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="dias_afastamento">Dias de afastamento *</Label>
                <Input
                  id="dias_afastamento"
                  type="number"
                  min={1}
                  value={form.dias_afastamento}
                  onChange={(e) => updateField("dias_afastamento", e.target.value)}
                  placeholder="Informe quantidade de dias"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analise de Risco</CardTitle>
            <CardDescription>Avalie gravidade, probabilidade e fatores.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Gravidade *</Label>
              <Select
                value={form.gravidade || undefined}
                onValueChange={(value) => updateField("gravidade", value as Gravidade)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Minima">Minima</SelectItem>
                  <SelectItem value="Mediana">Mediana</SelectItem>
                  <SelectItem value="Consideravel">Consideravel</SelectItem>
                  <SelectItem value="Critica">Critica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Probabilidade *</Label>
              <Select
                value={form.probabilidade || undefined}
                onValueChange={(value) => updateField("probabilidade", value as Probabilidade)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Improvavel">Improvavel</SelectItem>
                  <SelectItem value="Pouco Provavel">Pouco Provavel</SelectItem>
                  <SelectItem value="Provavel">Provavel</SelectItem>
                  <SelectItem value="Altamente Provavel">Altamente Provavel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parte_corpo_atingida">Parte do corpo atingida *</Label>
              <Select
                value={form.parte_corpo_atingida || undefined}
                onValueChange={(value) => updateField("parte_corpo_atingida", value)}
              >
                <SelectTrigger id="parte_corpo_atingida">
                  <SelectValue placeholder="Selecione a parte do corpo" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {DEFAULT_PARTES_CORPO_ATINGIDA.map((parte) => (
                    <SelectItem key={parte} value={parte}>
                      {parte}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="causa_raiz">Causa raiz *</Label>
              <Input
                id="causa_raiz"
                value={form.causa_raiz}
                onChange={(e) => updateField("causa_raiz", e.target.value)}
                placeholder="Descreva a causa principal"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="agente_causador">Agente causador *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => handleAgenteDialogChange(true)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Adicionar novo agente
                </Button>
              </div>
              <Select
                value={form.agente_causador || undefined}
                onValueChange={(value) => updateField("agente_causador", value)}
              >
                <SelectTrigger id="agente_causador">
                  <SelectValue placeholder="Selecione o agente causador" />
                </SelectTrigger>
                <SelectContent>
                  {agentesCausadores.map((agente) => (
                    <SelectItem key={agente} value={agente}>
                      {agente}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Não encontrou o agente? Use o botão acima para adicionar um novo.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="causa_acidente">Causa do acidente *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => handleCausaDialogChange(true)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Adicionar nova causa
                </Button>
              </div>
              <Select
                value={form.causa_acidente || undefined}
                onValueChange={(value) => updateField("causa_acidente", value)}
              >
                <SelectTrigger id="causa_acidente">
                  <SelectValue placeholder="Selecione a causa do acidente" />
                </SelectTrigger>
                <SelectContent>
                  {causasAcidente.map((causa) => (
                    <SelectItem key={causa} value={causa}>
                      {causa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Não encontrou a causa? Use o botão acima para adicionar uma nova.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relato</CardTitle>
            <CardDescription>Detalhe o que aconteceu e pontos complementares.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="descricao_detalhada">Descricao detalhada *</Label>
              <Textarea
                id="descricao_detalhada"
                rows={6}
                value={form.descricao_detalhada}
                onChange={(e) => updateField("descricao_detalhada", e.target.value)}
                placeholder="Descreva a ocorrencia com contexto, sequencia e impacto."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observacoes *</Label>
              <Textarea
                id="observacoes"
                rows={4}
                value={form.observacoes}
                onChange={(e) => updateField("observacoes", e.target.value)}
                placeholder="Informe observacoes adicionais."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-red-700" />
              Seguranca e Assinatura
            </CardTitle>
            <CardDescription>
              O campo investigador e preenchido apenas apos autenticacao.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="investigador">Investigador *</Label>
              <Input id="investigador" value={form.investigador} readOnly disabled />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant={isSigned ? "secondary" : "outline"}
                onClick={handleOpenSignDialog}
                className="w-full"
              >
                {isSigned ? "Reassinar Checklist" : "Assinar Checklist"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-red-700" />
              Anexos
            </CardTitle>
            <CardDescription>Anexe imagens, documentos ou evidencias da ocorrencia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              multiple
              onChange={(e) => setAttachments(Array.from(e.target.files ?? []))}
            />

            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-md border bg-gray-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAttachment(index)}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhum arquivo selecionado.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-100 bg-white">
          <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">Pronto para enviar?</p>
              <p className="text-sm text-gray-600">
                {nextPendingHint || "Todos os requisitos obrigatorios foram preenchidos."}
              </p>
            </div>
            <Button
              type="submit"
              className="w-full bg-red-700 hover:bg-red-800 md:w-auto"
              disabled={isSaving}
            >
              {isSaving ? "Enviando..." : "Enviar Investigacao"}
            </Button>
          </CardContent>
        </Card>
      </form>

      <Dialog open={colaboradorDialogOpen} onOpenChange={handleColaboradorDialogChange}>
        {colaboradorDialogOpen && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar colaborador (operador)</DialogTitle>
              <DialogDescription>
                Ao salvar, o colaborador sera incluido na tabela de operadores e passara a aparecer
                na lista de sugestoes.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="novo-colaborador-matricula">Matricula *</Label>
                <Input
                  id="novo-colaborador-matricula"
                  value={novoColaboradorMatricula}
                  onChange={(e) =>
                    setNovoColaboradorMatricula(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="0000"
                  maxLength={4}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="novo-colaborador-nome">Nome *</Label>
                <Input
                  id="novo-colaborador-nome"
                  value={novoColaboradorNome}
                  onChange={(e) => setNovoColaboradorNome(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="novo-colaborador-cargo">Cargo</Label>
                <Input
                  id="novo-colaborador-cargo"
                  value={novoColaboradorCargo}
                  onChange={(e) => setNovoColaboradorCargo(e.target.value)}
                  placeholder="Cargo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="novo-colaborador-setor">Setor</Label>
                <Input
                  id="novo-colaborador-setor"
                  list="setores-colaborador-list"
                  value={novoColaboradorSetor}
                  onChange={(e) => setNovoColaboradorSetor(e.target.value)}
                  placeholder="Setor"
                />
                <datalist id="setores-colaborador-list">
                  {setoresDisponiveis.map((setor) => (
                    <option key={setor} value={setor} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="novo-colaborador-senha">Senha inicial (opcional)</Label>
                <Input
                  id="novo-colaborador-senha"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={novoColaboradorSenha}
                  onChange={(e) =>
                    setNovoColaboradorSenha(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="4 digitos"
                  autoComplete="new-password"
                />
                <p className="text-xs text-gray-500">
                  Se informar, use 4 digitos numericos.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleColaboradorDialogChange(false)}
                disabled={isSavingColaborador}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleSalvarNovoColaborador} disabled={isSavingColaborador}>
                {isSavingColaborador ? "Salvando..." : "Salvar colaborador"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={signDialogOpen} onOpenChange={handleSignDialogChange}>
        {signDialogOpen && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assinar Checklist</DialogTitle>
              <DialogDescription>
                Informe o investigador e a senha para preencher a assinatura.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="authInvestigator">Investigador</Label>
              <Select
                value={selectedInvestigator || undefined}
                onValueChange={setSelectedInvestigator}
                disabled={loadingInvestigators || investigators.length === 0}
              >
                <SelectTrigger id="authInvestigator">
                  <SelectValue
                    placeholder={
                      loadingInvestigators
                        ? "Carregando investigadores..."
                        : "Selecione o investigador"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {investigators.map((item) => (
                    <SelectItem key={item.username} value={item.username}>
                      {item.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingInvestigators && investigators.length === 0 && (
                <p className="text-xs text-amber-600">
                  Nenhum investigador cadastrado no administrativo.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="authPassword">Senha</Label>
              <Input
                id="authPassword"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSignDialogChange(false)}
                disabled={isSigning}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleSignChecklist} disabled={isSigning}>
                {isSigning ? "Validando..." : "Confirmar assinatura"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={agenteDialogOpen} onOpenChange={handleAgenteDialogChange}>
        {agenteDialogOpen && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar novo agente causador</DialogTitle>
              <DialogDescription>
                Cadastre um agente que ainda não exista na lista para usar neste formulário.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="novo-agente">Descrição do agente</Label>
              <Input
                id="novo-agente"
                value={novoAgente}
                onChange={(e) => setNovoAgente(e.target.value)}
                placeholder="Ex: Superfície escorregadia"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleAgenteDialogChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleAdicionarNovoAgente}>
                Salvar agente
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={causaDialogOpen} onOpenChange={handleCausaDialogChange}>
        {causaDialogOpen && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar nova causa do acidente</DialogTitle>
              <DialogDescription>
                Cadastre uma causa que ainda não exista na lista para usar neste formulário.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="nova-causa">Descrição da causa</Label>
              <Input
                id="nova-causa"
                value={novaCausa}
                onChange={(e) => setNovaCausa(e.target.value)}
                placeholder="Ex: Procedimento inadequado"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleCausaDialogChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleAdicionarNovaCausa}>
                Salvar causa
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={whatsappDialogOpen} onOpenChange={handleWhatsappDialogChange}>
        {whatsappDialogOpen && (
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ocorrencia finalizada</DialogTitle>
              <DialogDescription>
                Resumo pronto para compartilhar no grupo geral da seguranca via WhatsApp.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="resumo-whatsapp">Resumo da ocorrencia</Label>
              <Textarea id="resumo-whatsapp" rows={12} value={whatsappResumo} readOnly />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCopyWhatsappResumo}>
                Copiar resumo
              </Button>
              <Button type="button" onClick={handleOpenWhatsapp}>
                Abrir WhatsApp
              </Button>
              <Button type="button" variant="secondary" onClick={() => handleWhatsappDialogChange(false)}>
                Finalizar e ir para início
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default InvestigacaoAcidente;

