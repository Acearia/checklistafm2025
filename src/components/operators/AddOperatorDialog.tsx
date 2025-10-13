
import React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const formSchema = z.object({
  id: z.string().min(4, { message: "Matrícula deve ter pelo menos 4 caracteres" }).max(4, { message: "Matrícula deve ter exatamente 4 caracteres" }),
  name: z.string().min(2, { message: "Nome deve ter pelo menos 2 caracteres" }),
  cargo: z.string().optional(),
  setor: z.string().optional(),
  senha: z.string().length(4, { message: "Senha deve ter exatamente 4 dígitos" }).regex(/^\d+$/, { message: "Senha deve conter apenas números" }),
});

const NONE_SECTOR_VALUE = "__none";

type SectorOption = {
  id: string;
  name: string;
};

interface AddOperatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddOperator: (data: { id: string; name: string; cargo?: string; setor?: string; senha: string }) => void;
  sectors?: SectorOption[];
}

export function AddOperatorDialog({ 
  open, 
  onOpenChange, 
  onAddOperator,
  sectors = [],
}: AddOperatorDialogProps) {
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
    
    // Now we're sure name and id are non-empty strings as required by the type
    onAddOperator({
      id: values.id,
      name: values.name,
      cargo: values.cargo,
      setor: values.setor === NONE_SECTOR_VALUE ? undefined : values.setor,
      senha: values.senha
    });
    
    form.reset();
    onOpenChange(false);
  }

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
                  <FormLabel>Setor</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || NONE_SECTOR_VALUE}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um setor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_SECTOR_VALUE}>Sem setor definido</SelectItem>
                      {sectors.map((sector) => (
                        <SelectItem key={sector.id} value={sector.name}>
                          {sector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="senha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha* (4 dígitos)</FormLabel>
                  <FormControl>
                    <Input 
                      type="password"
                      placeholder="••••"
                      maxLength={4}
                      {...field}
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
