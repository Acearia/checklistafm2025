
import React, { useEffect } from "react";
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
import { Operator } from "@/lib/data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

const formSchema = z
  .object({
    id: z.string(),
    name: z.string().min(2, { message: "Nome deve ter pelo menos 2 caracteres" }),
    cargo: z.string().optional(),
    setor: z.string().optional(),
    senha: z
      .string()
      .optional()
      .refine((val) => !val || (val.length === 4 && /^\d+$/.test(val)), {
        message: "Senha deve ter exatamente 4 dígitos numéricos",
      }),
    isLeader: z.boolean().default(false),
    leaderEmail: z.string().email({ message: "Informe um email válido" }).optional(),
    leaderPassword: z.string().min(4, { message: "Senha deve ter pelo menos 4 caracteres" }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isLeader) {
      if (!data.leaderEmail) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["leaderEmail"],
          message: "Informe o email do líder.",
        });
      }
    }
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
    isLeader?: boolean;
    leaderEmail?: string;
        leaderPassword?: string;
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
  // Check if operator exists to avoid null reference errors
  const operatorData = operator || { id: "", name: "", cargo: "", setor: "", senha: "" };
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: operatorData.id || "",
      name: operatorData.name || "",
      cargo: operatorData.cargo || "",
      setor: operatorData.setor || NONE_SECTOR_VALUE,
      senha: operatorData.senha || "",
      isLeader: Boolean(operatorData.isLeader),
      leaderEmail: operatorData.leaderEmail || "",
      leaderPassword: "",
    },
  });

  // Update form values when the operator changes
  useEffect(() => {
    if (operator) {
      form.reset({
        id: operator.id || "",
        name: operator.name || "",
        cargo: operator.cargo || "",
        setor: operator.setor || NONE_SECTOR_VALUE,
        senha: operator.senha || "",
        isLeader: Boolean(operator.isLeader),
        leaderEmail: operator.leaderEmail || "",
        leaderPassword: "",
      });
    }
  }, [operator, form]);

  const isLeader = form.watch("isLeader");
  function onSubmit(values: z.infer<typeof formSchema>) {
    // Ensure name is required and not empty
    if (!values.name.trim()) return;
    
    onEditOperator({
      id: values.id,
      name: values.name,
      cargo: values.cargo,
      setor: values.setor === NONE_SECTOR_VALUE ? undefined : values.setor,
      senha: values.senha,
      isLeader: values.isLeader,
      leaderEmail: values.leaderEmail || undefined,
      leaderSector:
        values.setor && values.setor !== NONE_SECTOR_VALUE
          ? values.setor
          : undefined,
      leaderPassword: values.leaderPassword || undefined,
    });
    
    form.reset();
    onOpenChange(false);
  }

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
                  <FormLabel>Senha (4 dígitos - deixe em branco para não alterar)</FormLabel>
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
            <FormField
              control={form.control}
              name="isLeader"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <FormLabel>Este operador é líder?</FormLabel>
                      <FormDescription>Habilite para gerenciar acesso ao painel de líderes.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />

            {isLeader && (
              <>
                <FormField
                  control={form.control}
                  name="leaderEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email do líder*</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="leaderPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova senha do líder (opcional)</FormLabel>
                      <FormDescription>Preencha para alterar a senha atual.</FormDescription>
                      <FormControl>
                        <Input type="password" placeholder="Defina uma nova senha" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
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
