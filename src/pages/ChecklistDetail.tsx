
import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  Save, 
  Printer, 
  Download, 
  Archive, 
  CheckCircle, 
  XCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SignatureCanvas from "@/components/SignatureCanvas";

interface ChecklistItem {
  id: string;
  question: string;
  required: boolean;
  answer: "Sim" | "Não" | "";
}

interface Inspection {
  id: string;
  equipment: {
    id: string;
    name: string;
    kp: string;
    sector: string;
    bridgeNumber?: string;
  };
  operator: {
    id: string;
    name: string;
    registration: string;
  };
  submissionDate: string;
  checklist: ChecklistItem[];
  observations: string;
  signature?: string;
  status: "completed" | "archived" | "draft";
  hasIssues: boolean;
}

const ChecklistDetail = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [observations, setObservations] = useState("");
  const [archived, setArchived] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const isLeaderView = location.pathname.includes("/leader");
  const returnPath = isLeaderView ? "/leader/dashboard" : "/admin/inspections";
  
  useEffect(() => {
    const loadInspection = () => {
      setIsLoading(true);
      
      try {
        const storedInspections = localStorage.getItem('checklistafm-inspections');
        if (storedInspections && id) {
          const inspections: Inspection[] = JSON.parse(storedInspections);
          const foundInspection = inspections.find(insp => insp.id === id);
          
          if (foundInspection) {
            setInspection(foundInspection);
            setObservations(foundInspection.observations || "");
            setArchived(foundInspection.status === "archived");
            setSignature(foundInspection.signature || null);
            setCanEdit(foundInspection.status !== "archived");
          } else {
            toast({
              title: "Checklist não encontrado",
              description: "O checklist solicitado não foi encontrado",
              variant: "destructive"
            });
            navigate(returnPath);
          }
        } else {
          toast({
            title: "Erro ao carregar dados",
            description: "Não foi possível carregar os dados do checklist",
            variant: "destructive"
          });
          navigate(returnPath);
        }
      } catch (error) {
        console.error("Erro ao carregar inspeção:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Ocorreu um erro ao tentar carregar os dados do checklist",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInspection();
  }, [id, navigate, toast, returnPath]);
  
  const handleAnswerChange = (itemId: string, value: "Sim" | "Não") => {
    if (!inspection || !canEdit) return;
    
    const updatedChecklist = inspection.checklist.map(item => {
      if (item.id === itemId) {
        return { ...item, answer: value };
      }
      return item;
    });
    
    const hasIssues = updatedChecklist.some(item => item.answer === "Não");
    
    setInspection({
      ...inspection,
      checklist: updatedChecklist,
      hasIssues
    });
  };
  
  const handleSave = () => {
    if (!inspection) return;
    
    try {
      const storedInspections = localStorage.getItem('checklistafm-inspections');
      if (storedInspections) {
        const inspections: Inspection[] = JSON.parse(storedInspections);
        const updatedInspections = inspections.map(insp => {
          if (insp.id === inspection.id) {
            return {
              ...inspection,
              observations,
              signature,
              status: archived ? "archived" : "completed"
            };
          }
          return insp;
        });
        
        localStorage.setItem('checklistafm-inspections', JSON.stringify(updatedInspections));
        
        toast({
          title: "Checklist salvo",
          description: "As alterações foram salvas com sucesso"
        });
      }
    } catch (error) {
      console.error("Erro ao salvar checklist:", error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao tentar salvar as alterações",
        variant: "destructive"
      });
    }
  };
  
  const handleArchiveToggle = () => {
    if (!canEdit) return;
    
    setArchived(!archived);
    toast({
      title: archived ? "Checklist ativado" : "Checklist arquivado",
      description: archived 
        ? "O checklist foi marcado como ativo" 
        : "O checklist foi arquivado e não poderá mais ser editado"
    });
    
    if (!archived) {
      setCanEdit(false);
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch (e) {
      return dateString;
    }
  };
  
  const handleSignatureSave = (signatureData: string) => {
    setSignature(signatureData);
    setShowSignatureDialog(false);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
        <span className="ml-2">Carregando checklist...</span>
      </div>
    );
  }
  
  if (!inspection) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-bold">Checklist não encontrado</h2>
        <p className="text-muted-foreground mt-2">O checklist solicitado não está disponível</p>
        <Button 
          onClick={() => navigate(returnPath)} 
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }
  
  // Add safe check for inspection.checklist before accessing .every method
  const hasAllAnswers = inspection.checklist && inspection.checklist.length > 0 
    ? inspection.checklist.every(item => item.answer !== "") 
    : false;
    
  // Also add safe check for inspection.checklist before accessing .some method  
  const hasIssues = inspection.checklist && inspection.checklist.length > 0
    ? inspection.checklist.some(item => item.answer === "Não")
    : false;
  
  return (
    <div className="container max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate(returnPath)}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Detalhes do Checklist</h1>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />
            Imprimir
          </Button>
          
          {canEdit && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleSave}
              disabled={!hasAllAnswers}
            >
              <Save className="h-4 w-4 mr-1" />
              Salvar
            </Button>
          )}
        </div>
      </div>
      
      <Card className="mb-6">
        <CardHeader className="pb-4 border-b">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">
                Checklist #{inspection.id.substring(0, 8)}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Data: {formatDate(inspection.submissionDate)}
              </p>
            </div>
            
            <div className="flex flex-col items-end">
              {hasIssues ? (
                <Badge variant="destructive" className="mb-1">
                  <XCircle className="h-3 w-3 mr-1" />
                  Com irregularidades
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mb-1">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Sem irregularidades
                </Badge>
              )}
              
              {archived && (
                <Badge variant="outline" className="bg-gray-100">
                  <Archive className="h-3 w-3 mr-1" />
                  Arquivado
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold mb-2">Equipamento</h3>
              <div className="space-y-1">
                <p><span className="text-sm text-muted-foreground">Nome:</span> {inspection.equipment.name}</p>
                <p><span className="text-sm text-muted-foreground">KP:</span> {inspection.equipment.kp}</p>
                <p><span className="text-sm text-muted-foreground">Setor:</span> {inspection.equipment.sector}</p>
                <p><span className="text-sm text-muted-foreground">Ponte:</span> {inspection.equipment.bridgeNumber || "N/A"}</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Operador</h3>
              <div className="space-y-1">
                <p><span className="text-sm text-muted-foreground">Nome:</span> {inspection.operator.name}</p>
                <p><span className="text-sm text-muted-foreground">Matrícula:</span> {inspection.operator.registration || "N/A"}</p>
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Itens do Checklist</h3>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mr-2">Arquivar checklist</span>
                <Switch 
                  checked={archived} 
                  onCheckedChange={handleArchiveToggle}
                  disabled={!canEdit}
                />
              </div>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60%]">Item de verificação</TableHead>
                  <TableHead className="text-center">Sim</TableHead>
                  <TableHead className="text-center">Não</TableHead>
                  <TableHead className="text-center">Obrigatório</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspection.checklist && inspection.checklist.map((item) => (
                  <TableRow 
                    key={item.id}
                    className={item.answer === "Não" ? "bg-red-50" : ""}
                  >
                    <TableCell>{item.question}</TableCell>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={item.answer === "Sim"}
                        onCheckedChange={() => handleAnswerChange(item.id, "Sim")}
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={item.answer === "Não"}
                        onCheckedChange={() => handleAnswerChange(item.id, "Não")}
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {item.required ? "Sim" : "Não"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Observações</h3>
            <Textarea 
              value={observations} 
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Digite observações adicionais aqui..."
              className="min-h-[100px]"
              disabled={!canEdit}
            />
          </div>
          
          <div className="mb-2">
            <h3 className="font-semibold mb-2">Assinatura</h3>
            {signature ? (
              <div className="border rounded-md p-4 bg-gray-50">
                <img 
                  src={signature} 
                  alt="Assinatura do operador" 
                  className="max-h-32 mx-auto"
                />
              </div>
            ) : (
              <div className="border rounded-md p-4 bg-gray-50 text-center">
                <p className="text-muted-foreground">Nenhuma assinatura registrada</p>
                {canEdit && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowSignatureDialog(true)}
                    className="mt-2"
                  >
                    Adicionar assinatura
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between border-t pt-6">
          <Button 
            variant="outline" 
            onClick={() => navigate(returnPath)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          
          {canEdit && (
            <Button 
              onClick={handleSave}
              disabled={!hasAllAnswers}
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar alterações
            </Button>
          )}
        </CardFooter>
      </Card>
      
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar assinatura</DialogTitle>
            <DialogDescription>
              Use o mouse ou o dedo para assinar no campo abaixo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="my-4">
            <SignatureCanvas onSignatureChange={handleSignatureSave} />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignatureDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChecklistDetail;

