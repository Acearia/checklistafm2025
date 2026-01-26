
import React, { useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  id: z
    .string()
    .min(4, { message: "Matrícula deve ter pelo menos 4 caracteres" })
    .max(4, { message: "Matrícula deve ter exatamente 4 caracteres" }),
  name: z.string().min(2, { message: "Nome deve ter pelo menos 2 caracteres" }),
  cargo: z.string().optional(),
  setor: z.string().optional(),
  senha: z
    .string()
    .regex(/^\d{4}$/, { message: "Senha deve ter exatamente 4 dígitos numéricos" })
    .or(z.literal(""))
    .optional(),
});

const NONE_SECTOR_VALUE = "__none";

type SectorOption = {
  id: string;
  name: string;
};

interface AddOperatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddOperator: (data: { id: string; name: string; cargo?: string; setor?: string; senha?: string }) => void;
  sectors?: SectorOption[];
}

export function AddOperatorDialog({ 
  open, 
  onOpenChange, 
  onAddOperator,
  sectors = [],
}: AddOperatorDialogProps) {
  const [selectedSectors, setSelectedSectors] = React.useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: "",
      name: "",
      cargo: "",
      setor: NONE_SECTOR_VALUE,
      senha: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Ensure name and id are required and not empty
    if (!values.name.trim() || !values.id.trim()) return;
    const sectorsValue =
      selectedSectors.length > 0
        ? selectedSectors.join(", ")
        : values.setor === NONE_SECTOR_VALUE
          ? undefined
          : values.setor;
    
    // Now we're sure name and id are non-empty strings as required by the type
    onAddOperator({
      id: values.id,
      name: values.name,
      cargo: values.cargo,
      setor: sectorsValue,
      senha: values.senha && values.senha.length === 4 ? values.senha : undefined,
    });
    
    form.reset();
    setSelectedSectors([]);
    onOpenChange(false);
  }

  const toggleSector = (name: string) => {
    setSelectedSectors((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  };

  React.useEffect(() => {
    if (!open) {
      setSelectedSectors([]);
      form.reset({
        id: "",
        name: "",
        cargo: "",
        setor: NONE_SECTOR_VALUE,
        senha: "",
      });
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Operador</DialogTitle>
          <DialogDescription>
            Preencha os dados para adicionar um novo operador ao sistema.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Matrícula* (4 dígitos)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="1234" 
                      maxLength={4}
                      {...field} 
                    />
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
              render={({ field }) => (
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
                  <FormLabel>Senha (4 dígitos, opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="password"
                      placeholder="••••"
                      maxLength={4}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Adicionar Operador</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
