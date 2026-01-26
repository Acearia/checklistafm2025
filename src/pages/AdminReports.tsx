import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Download, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { useSupabaseData } from "@/hooks/useSupabaseData";

const AdminReports = () => {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const { toast } = useToast();
  const { inspections, loading } = useSupabaseData();

  const filteredInspections = useMemo(() => {
    if (!date) return inspections;
    const target = format(date, "yyyy-MM-dd");
    return inspections.filter((inspection: any) => {
      const submissionDate = inspection.submission_date || inspection.submissionDate;
      if (!submissionDate) return false;
      const submission = format(new Date(submissionDate), "yyyy-MM-dd");
      return submission === target;
    });
  }, [date, inspections]);

  const generateInspectionPDF = () => {
    if (loading) {
      toast({
        title: "Carregando dados",
        description: "Aguarde enquanto carregamos as inspeções.",
      });
      return;
    }

    if (filteredInspections.length === 0) {
      toast({
        title: "Nenhuma inspeção encontrada",
        description: "Não há inspeções para a data selecionada.",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.text("Relatório de Inspeções", 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Data do relatório: ${date ? format(date, "PP", { locale: ptBR }) : "Não selecionada"}`, 20, 30);
      
      // Adicionar dados ao PDF
      doc.setFontSize(14);
      doc.text("Lista de Inspeções", 20, 45);
      
      let yPosition = 55;
      
      filteredInspections.forEach((inspection: any, index: number) => {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFontSize(12);
        doc.text(`${index + 1}. Equipamento: ${inspection.equipment?.name ?? "Não informado"}`, 20, yPosition);
        doc.text(`   Operador: ${inspection.operator?.name ?? "Não informado"}`, 30, yPosition + 7);
        const submissionDate = inspection.submission_date || inspection.submissionDate;
        doc.text(`   Data: ${submissionDate ? new Date(submissionDate).toLocaleDateString() : "N/A"}`, 30, yPosition + 14);
        
        yPosition += 25;
      });
      
      // Salvar o PDF
      doc.save(`relatorio-inspecoes-${format(new Date(), "dd-MM-yyyy")}.pdf`);
      
      toast({
        title: "PDF gerado com sucesso",
        description: "O relatório foi baixado para o seu computador",
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o relatório",
        variant: "destructive",
      });
    }
  };

  const generateProblemsPDF = () => {
    if (loading) {
      toast({
        title: "Carregando dados",
        description: "Aguarde enquanto carregamos as inspeções.",
      });
      return;
    }

    if (filteredInspections.length === 0) {
      toast({
        title: "Nenhum problema encontrado",
        description: "Não há inspeções com problemas para a data selecionada.",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.text("Relatório de Problemas", 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Data do relatório: ${format(new Date(), "PP", { locale: ptBR })}`, 20, 30);
      
      let problems: any[] = [];
      
      // Coletar problemas de todas as inspeções
      filteredInspections.forEach((inspection: any) => {
        const checklistAnswers = inspection.checklist_answers || inspection.checklist || [];
        const inspectionProblems = checklistAnswers
          .filter((item: any) => item.answer === "Não")
          .map((item: any) => ({
            equipment: inspection.equipment?.name ?? "Não informado",
            date: inspection.submission_date
              ? new Date(inspection.submission_date).toLocaleDateString()
              : inspection.submissionDate
                ? new Date(inspection.submissionDate).toLocaleDateString()
                : "N/A",
            problem: item.question
          }));
        
        problems = [...problems, ...inspectionProblems];
      });
      
      // Adicionar problemas ao PDF
      doc.setFontSize(14);
      doc.text("Problemas Identificados", 20, 45);
      
      let yPosition = 55;
      
      problems.forEach((problem, index) => {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFontSize(12);
        doc.text(`${index + 1}. Equipamento: ${problem.equipment}`, 20, yPosition);
        doc.text(`   Problema: ${problem.problem}`, 30, yPosition + 7);
        doc.text(`   Data: ${problem.date}`, 30, yPosition + 14);
        
        yPosition += 25;
      });
      
      // Salvar o PDF
      doc.save(`relatorio-problemas-${format(new Date(), "dd-MM-yyyy")}.pdf`);
      
      toast({
        title: "PDF gerado com sucesso",
        description: "O relatório foi baixado para o seu computador",
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o relatório",
        variant: "destructive",
      });
    }
  };

  const downloadInspectionDetails = (inspection: any) => {
    try {
      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.text("Relatório de Inspeção", 20, 20);

      doc.setFontSize(12);
      const submissionDate = inspection.submission_date || inspection.submissionDate;
      doc.text(
        `Data da inspeção: ${submissionDate ? new Date(submissionDate).toLocaleString() : "N/A"}`,
        20,
        30
      );
      doc.text(`Equipamento: ${inspection.equipment?.name ?? "Não informado"}`, 20, 40);
      doc.text(`Operador: ${inspection.operator?.name ?? "Não informado"}`, 20, 50);

      const checklistAnswers = inspection.checklist_answers || inspection.checklist || [];
      doc.text("Respostas do checklist:", 20, 65);
      let y = 75;
      checklistAnswers.forEach((item: any, index: number) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(`${index + 1}. ${item.question} - ${item.answer ?? "N/A"}`, 20, y);
        y += 8;
      });

      doc.save(`inspecao-${inspection.id}.pdf`);

      toast({
        title: "Relatório baixado",
        description: "O PDF da inspeção foi gerado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao baixar relatório da inspeção:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o relatório da inspeção.",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Relatórios</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Relatório de Inspeções</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Exporta todas as inspeções realizadas no período selecionado, com detalhes sobre equipamentos, operadores e problemas encontrados.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PP", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button 
                className="flex-1 sm:flex-none bg-red-700 hover:bg-red-800"
                onClick={generateInspectionPDF}
              >
                <FileText className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Relatório de Problemas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Exporta detalhes de todos os problemas encontrados durante as inspeções, agrupados por equipamento e tipo de problema.
            </p>
            <div className="flex justify-end">
              <Button 
                className="bg-red-700 hover:bg-red-800"
                onClick={generateProblemsPDF}
              >
                <FileText className="mr-2 h-4 w-4" />
                Gerar Relatório
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Carregando inspeções...</p>
          ) : filteredInspections.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum relatório disponível no momento.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4">Equipamento</th>
                    <th className="text-left py-3 px-4">Operador</th>
                    <th className="text-left py-3 px-4">Data</th>
                    <th className="text-center py-3 px-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInspections.map((inspection: any) => {
                    const submissionDate = inspection.submission_date || inspection.submissionDate;
                    return (
                      <tr key={inspection.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-4">{inspection.equipment?.name ?? "Não informado"}</td>
                        <td className="py-3 px-4">{inspection.operator?.name ?? "Não informado"}</td>
                        <td className="py-3 px-4">
                          {submissionDate ? new Date(submissionDate).toLocaleString() : "N/A"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadInspectionDetails(inspection)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Baixar PDF
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminReports;
