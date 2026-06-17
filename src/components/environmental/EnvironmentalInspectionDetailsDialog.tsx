import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type EnvironmentalInspectionDetail = {
  id?: string;
  numero_inspecao?: number;
  created_at?: string;
  realizado_por?: string;
  data_inspecao?: string;
  acompanhado_por?: string | null;
  gestor?: string | null;
  setor?: string;
  observacoes?: string | null;
  assinatura?: string | null;
  assinatura_realizado_por?: string | null;
  assinatura_acompanhante?: string | null;
  assinatura_gestor?: string | null;
  responses?: Array<{
    id?: string;
    numero?: string | number;
    secao?: string | null;
    pergunta?: string | null;
    resposta?: string | null;
    resposta_esperada?: string | null;
    irregular?: boolean | null;
    comentario?: string | null;
    foto_name?: string | null;
    foto_size?: number | null;
    foto_type?: string | null;
    foto_data_url?: string | null;
  }>;
};

type EnvironmentalInspectionResponse = NonNullable<EnvironmentalInspectionDetail["responses"]>[number];

const formatNumber = (value?: number | null) => String(Number(value) || 0).padStart(3, "0");

const formatDateOnly = (value?: string | null) => {
  if (!value) return "N/A";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFileSize = (value?: number | null) => {
  const size = Number(value || 0);
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const getResponsePhotoUrl = (response: EnvironmentalInspectionResponse) =>
  String(response?.foto_data_url || "").trim();

interface EnvironmentalInspectionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspection: EnvironmentalInspectionDetail | null;
  loading?: boolean;
}

const EnvironmentalInspectionDetailsDialog = ({
  open,
  onOpenChange,
  inspection,
  loading = false,
}: EnvironmentalInspectionDetailsDialogProps) => {
  const responses = Array.isArray(inspection?.responses) ? inspection.responses : [];
  const irregularResponses = responses.filter((item) => Boolean(item.irregular));
  const realizadoPorSignature = inspection?.assinatura_realizado_por || inspection?.assinatura || "";
  const acompanhanteSignature = inspection?.assinatura_acompanhante || "";
  const gestorSignature = inspection?.assinatura_gestor || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Inspeção Ambiental</DialogTitle>
          <DialogDescription>
            Registro {formatNumber(inspection?.numero_inspecao)} - {formatDateOnly(inspection?.data_inspecao)}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="rounded-md border bg-muted/40 p-8 text-center text-muted-foreground">
            Carregando detalhes...
          </div>
        ) : !inspection ? (
          <div className="rounded-md border bg-muted/40 p-8 text-center text-muted-foreground">
            Nenhuma inspeção selecionada.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <p className="text-xs uppercase text-muted-foreground">Número</p>
                  <CardTitle>{formatNumber(inspection.numero_inspecao)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <p className="text-xs uppercase text-muted-foreground">Setor</p>
                  <CardTitle className="text-base">{inspection.setor || "N/A"}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <p className="text-xs uppercase text-muted-foreground">Data</p>
                  <CardTitle className="text-base">{formatDateOnly(inspection.data_inspecao)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <p className="text-xs uppercase text-muted-foreground">Irregularidades</p>
                  <CardTitle className="text-base">{irregularResponses.length}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados principais</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <p><strong>Realizado por:</strong> {inspection.realizado_por || "N/A"}</p>
                <p><strong>Acompanhado por:</strong> {inspection.acompanhado_por || "N/A"}</p>
                <p><strong>Gestor:</strong> {inspection.gestor || "N/A"}</p>
                <p><strong>Criado em:</strong> {formatDateTime(inspection.created_at)}</p>
                <p><strong>Ass. realizado por:</strong> {realizadoPorSignature ? "Registrada" : "N/A"}</p>
                <p><strong>Ass. acompanhante:</strong> {acompanhanteSignature ? "Registrada" : "N/A"}</p>
                <p><strong>Ass. gestor:</strong> {gestorSignature ? "Registrada" : "N/A"}</p>
                <div className="md:col-span-2">
                  <strong>Observações gerais:</strong>
                  <p className="mt-1 rounded-md border bg-muted/30 p-3 text-muted-foreground">
                    {inspection.observacoes || "N/A"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Respostas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {responses.length === 0 ? (
                  <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                    Nenhuma resposta encontrada.
                  </div>
                ) : (
                  responses.map((response, index) => {
                    const photoUrl = getResponsePhotoUrl(response);
                    return (
                      <div key={response.id || `${response.numero}-${index}`} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground">
                              {response.secao || "Inspeção Ambiental"}
                            </p>
                            <p className="mt-1 font-semibold">
                              {response.numero || index + 1}. {response.pergunta || "Pergunta"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={response.irregular ? "destructive" : "secondary"}>
                              {response.irregular ? "Com irregularidade" : "Conforme"}
                            </Badge>
                            <Badge variant="outline">{response.resposta || "N/A"}</Badge>
                          </div>
                        </div>

                        {response.comentario ? (
                          <div className="mt-3 rounded-md bg-muted/30 p-3 text-sm">
                            <strong>Observação:</strong> {response.comentario}
                          </div>
                        ) : null}

                        {photoUrl ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {response.foto_name || "Foto"} {formatFileSize(response.foto_size)}
                            </p>
                            <img
                              src={photoUrl}
                              alt={`Foto da pergunta ${response.numero || index + 1}`}
                              className="max-h-[420px] w-full rounded-md border object-contain"
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {realizadoPorSignature || acompanhanteSignature || gestorSignature ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assinaturas</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  {realizadoPorSignature ? (
                    <div>
                      <p className="mb-2 text-sm font-semibold">Realizado por</p>
                      <img
                        src={realizadoPorSignature}
                        alt="Assinatura de quem realizou a inspeção ambiental"
                        className="max-h-48 rounded-md border bg-white object-contain"
                      />
                    </div>
                  ) : null}
                  {acompanhanteSignature ? (
                    <div>
                      <p className="mb-2 text-sm font-semibold">Acompanhante</p>
                      <img
                        src={acompanhanteSignature}
                        alt="Assinatura de quem acompanhou a inspeção ambiental"
                        className="max-h-48 rounded-md border bg-white object-contain"
                      />
                    </div>
                  ) : null}
                  {gestorSignature ? (
                    <div>
                      <p className="mb-2 text-sm font-semibold">Gestor</p>
                      <img
                        src={gestorSignature}
                        alt="Assinatura do gestor da inspecao ambiental"
                        className="max-h-48 rounded-md border bg-white object-contain"
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EnvironmentalInspectionDetailsDialog;
