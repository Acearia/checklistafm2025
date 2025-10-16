
import React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Equipment } from "@/lib/data";
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
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  id: z.string(),
  name: z.string().min(2, { message: "Nome deve ter pelo menos 2 caracteres" }),
  type: z.string().min(1, { message: "Tipo é obrigatório" }),
  kp: z.string().min(1, { message: "KP é obrigatório" }),
  sector: z.string().optional(),
  capacity: z.string().optional(),
});

export function EditEquipmentDialog({
  open,
  onOpenChange,
  equipment,
  onEditEquipment,
  sectors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment;
  onEditEquipment: (data: Equipment) => void;
  sectors: { id: string; name: string }[];
}) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: equipment.id,
      name: equipment.name,
      type: equipment.type,
      kp: equipment.kp,
      sector: equipment.sector,
      capacity: equipment.capacity,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Ensure all required fields have values
    if (!values.name.trim() || !values.type.trim() || !values.kp.trim()) return;
    
    // Now we're sure required fields have values
    onEditEquipment({
      id: values.id,
      name: values.name,
      type: values.type,
      kp: values.kp,
      sector: values.sector || "",
      capacity: values.capacity || "",
    });
    
    form.reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Equipamento</DialogTitle>
          <DialogDescription>
            Edite os dados do equipamento.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID</FormLabel>
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
                    <Input placeholder="Nome do equipamento" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo*</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de equipamento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">Ponte</SelectItem>
                      <SelectItem value="2">Talha</SelectItem>
                      <SelectItem value="3">Pórtico</SelectItem>
                      <SelectItem value="4">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="kp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>KP*</FormLabel>
                  <FormControl>
                    <Input placeholder="KP do equipamento" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sector"
              render={({ field }) => {
                const currentValue = field.value ?? "";
                const normalizedValue = currentValue || undefined;
                const shouldShowFallbackOption =
                  Boolean(currentValue) &&
                  !sectors.some((sector) => sector.name === currentValue);

                return (
                  <FormItem>
                    <FormLabel>Setor</FormLabel>
                    {sectors.length > 0 ? (
                      <Select
                        onValueChange={field.onChange}
                        value={normalizedValue}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o setor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {shouldShowFallbackOption && (
                            <SelectItem value={currentValue}>{currentValue}</SelectItem>
                          )}
                          {sectors.map((sector) => (
                            <SelectItem key={sector.id} value={sector.name}>
                              {sector.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input placeholder="Setor do equipamento" {...field} />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidade</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 5 toneladas" {...field} />
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
