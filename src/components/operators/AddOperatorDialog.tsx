
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
  isLeader: z.boolean().default(false),
  leaderEmail: z.string().email({ message: "Informe um email válido" }).optional(),
  leaderPassword: z.string().min(4, { message: "Senha deve ter pelo menos 4 caracteres" }).optional(),
}).superRefine((data, ctx) => {
  if (data.isLeader) {
    if (!data.leaderEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["leaderEmail"],
        message: "Informe o email do líder.",
      });
    }
    if (!data.setor || data.setor === NONE_SECTOR_VALUE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["setor"],
        message: "Defina o setor do operador (será o mesmo do líder).",
      });
    }
    if (!data.leaderPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["leaderPassword"],
        message: "Defina uma senha para o líder.",
      });
    }
  }
});

const NONE_SECTOR_VALUE = "__none";

type SectorOption = {
  id: string;
  name: string;
};

interface AddOperatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddOperator: (data: { id: string; name: string; cargo?: string; setor?: string; senha?: string; isLeader?: boolean; leaderSector?: string; leaderEmail?: string; leaderPassword?: string }) => void;
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
      isLeader: false,
      leaderEmail: "",
      leaderPassword: "",
    },
  });

  const isLeader = form.watch("isLeader");

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Ensure name and id are required and not empty
    if (!values.name.trim() || !values.id.trim()) return;
    
    // Now we're sure name and id are non-empty strings as required by the type
    onAddOperator({
      id: values.id,
      name: values.name,
      cargo: values.cargo,
      setor: values.setor === NONE_SECTOR_VALUE ? undefined : values.setor,
      senha: values.senha && values.senha.length === 4 ? values.senha : undefined,
      isLeader: values.isLeader,
            leaderEmail: values.leaderEmail || undefined,
      leaderPassword: values.leaderPassword || undefined,
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
            <FormField
              control={form.control}
              name="isLeader"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <FormLabel>Este operador é líder?</FormLabel>
                      <FormDescription>
                        Ative para definir acesso ao painel de líderes.
                      </FormDescription>
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
                      <FormLabel>Senha do líder*</FormLabel>
                      <FormDescription>Mínimo de 4 caracteres.</FormDescription>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Defina a senha de acesso"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <DialogFooter>
              <Button type="submit">Adicionar Operador</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
