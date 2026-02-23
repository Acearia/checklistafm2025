import React, { useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Operator } from "@/lib/data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const formSchema = z.object({
  id: z.string(),
  name: z.string().min(2, { message: "Nome deve ter pelo menos 2 caracteres" }),
  cargo: z.string().optional(),
  setor: z.string().optional(),
  senha: z
    .string()
    .optional()
    .refine((val) => !val || (val.length >= 4 && /^\d+$/.test(val)), {
      message: "Senha deve ter no mínimo 4 dígitos numéricos",
    }),
});

const NONE_SECTOR_VALUE = "__none";

type SectorOption = {
  id: string;
  name: string;
};

interface EditOperatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operator: Operator;
  onEditOperator: (data: {
    id: string;
    name: string;
    cargo?: string;
    setor?: string;
    senha?: string;
  }) => void;
  sectors?: SectorOption[];
}

export function EditOperatorDialog({
  open,
  onOpenChange,
  operator,
  onEditOperator,
  sectors = [],
}: EditOperatorDialogProps) {
  const operatorData = operator || { id: "", name: "", cargo: "", setor: "", senha: "" };
  const [selectedSectors, setSelectedSectors] = React.useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: operatorData.id || "",
      name: operatorData.name || "",
      cargo: operatorData.cargo || "",
      setor: operatorData.setor || NONE_SECTOR_VALUE,
      senha: operatorData.senha || "",
    },
  });

  useEffect(() => {
    if (operator) {
      form.reset({
        id: operator.id || "",
        name: operator.name || "",
        cargo: operator.cargo || "",
        setor: operator.setor || NONE_SECTOR_VALUE,
        senha: operator.senha || "",
      });
    }
  }, [operator, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!values.name.trim()) return;

    const sectorsValue =
      selectedSectors.length > 0
        ? selectedSectors.join(", ")
        : values.setor === NONE_SECTOR_VALUE
          ? undefined
          : values.setor;

    onEditOperator({
      id: values.id,
      name: values.name,
      cargo: values.cargo,
      setor: sectorsValue,
      senha: values.senha,
    });

    form.reset();
    onOpenChange(false);
  }

  const toggleSector = (name: string) => {
    setSelectedSectors((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  };

  React.useEffect(() => {
    if (operator?.setor) {
      const parts = operator.setor.split(",").map((s) => s.trim()).filter(Boolean);
      setSelectedSectors(parts);
    } else {
      setSelectedSectors([]);
    }
  }, [operator]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Operador</DialogTitle>
          <DialogDescription>
            Edite os dados do operador.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Matrícula</FormLabel>
                  <FormControl>
                    <Input {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome*</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do operador" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cargo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo</FormLabel>
                  <FormControl>
                    <Input placeholder="Cargo do operador" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="setor"
              render={() => (
                <FormItem>
                  <FormLabel>Setores (selecione um ou mais)</FormLabel>
                  <div className="flex flex-col gap-2 max-h-48 overflow-auto border rounded-md p-2">
                    {sectors.length === 0 && (
                      <p className="text-xs text-gray-500">Nenhum setor cadastrado.</p>
                    )}
                    {sectors.map((sector) => (
                      <label key={sector.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selectedSectors.includes(sector.name)}
                          onChange={() => toggleSector(sector.name)}
                        />
                        <span>{sector.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Se nada for marcado, o operador ficará sem setor.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="senha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha (mínimo 4 dígitos - deixe em branco para não alterar)</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••"
                      maxLength={20}
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Alterações</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
