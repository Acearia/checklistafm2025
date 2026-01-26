
import { INITIAL_DATA_LOADED_KEY, CHECKLIST_STORE_KEY, CHECKLIST_TEMPLATE_KEY } from "./types";
import { getChecklistState } from "./checklistState";
import { initialChecklistState } from "./types";

// Função de força bruta para reinicializar equipamentos
export const forceEquipmentInitialization = async () => {
  try {
    const { equipments } = await import('./data');
    localStorage.setItem('checklistafm-equipments', JSON.stringify(equipments));
    console.log('Equipamentos forçadamente reinicializados:', equipments.length);
    return equipments;
  } catch (error) {
    console.error("Failed to force equipment initialization:", error);
    return [];
  }
};

// Verificar se o banco de dados está conectado (Supabase sempre conectado)
export const isDatabaseConnected = (): boolean => {
  return true;
};

// Garantir que os dados iniciais sejam armazenados
export const initializeDefaultData = () => {
  console.log("Initializing default data...");
  
  // Verificar se os dados já foram inicializados anteriormente
  const isInitialized = localStorage.getItem(INITIAL_DATA_LOADED_KEY);
  
  if (isInitialized === 'true') {
    console.log("Data was already initialized. Checking consistency...");
    
    // Verificar se os dados estão consistentes
    const operatorsData = localStorage.getItem('checklistafm-operators');
    const equipmentsData = localStorage.getItem('checklistafm-equipments');
    
    let needsReinitialization = false;
    
    if (!operatorsData) {
      console.log("No operators found despite initialization flag. Will reinitialize.");
      needsReinitialization = true;
    }
    
    if (!equipmentsData) {
      console.log("No equipments found despite initialization flag. Will reinitialize.");
      needsReinitialization = true;
    }
    
    if (!needsReinitialization) {
      console.log("Data consistency check passed. Using existing data.");
      return; // Dados já inicializados e consistentes
    }
  }
  
  // Se chegou aqui, precisamos inicializar ou reinicializar os dados
  const operatorsData = localStorage.getItem('checklistafm-operators');
  const equipmentsData = localStorage.getItem('checklistafm-equipments');
  
  let operatorsInitialized = false;
  let equipmentsInitialized = false;
  
  // Se não existirem operadores e equipamentos, importa dos dados iniciais
  if (!operatorsData) {
    console.log("No operators found in localStorage, importing initial data");
    import('./data').then(({ operators }) => {
      localStorage.setItem('checklistafm-operators', JSON.stringify(operators));
      console.log('Operadores inicializados com sucesso:', operators.length);
      operatorsInitialized = true;
      checkInitializationComplete();
    }).catch(error => {
      console.error("Failed to import operators:", error);
    });
  } else {
    console.log("Operators already exist in localStorage");
    try {
      const parsedOperators = JSON.parse(operatorsData);
      console.log(`Found ${parsedOperators.length} operators in localStorage`);
      operatorsInitialized = true;
      checkInitializationComplete();
    } catch (e) {
      console.error("Error parsing operators in localStorage:", e);
      import('./data').then(({ operators }) => {
        localStorage.setItem('checklistafm-operators', JSON.stringify(operators));
        console.log('Operadores recarregados com sucesso após erro');
        operatorsInitialized = true;
        checkInitializationComplete();
      });
    }
  }
  
  if (!equipmentsData) {
    console.log("No equipments found in localStorage, importing initial data");
    import('./data').then(({ equipments }) => {
      localStorage.setItem('checklistafm-equipments', JSON.stringify(equipments));
      console.log('Equipamentos inicializados com sucesso:', equipments.length);
      equipmentsInitialized = true;
      checkInitializationComplete();
    }).catch(error => {
      console.error("Failed to import equipments:", error);
    });
  } else {
    console.log("Equipments already exist in localStorage");
    try {
      const parsedEquipments = JSON.parse(equipmentsData);
      if (Array.isArray(parsedEquipments) && parsedEquipments.length > 0) {
        console.log(`Found ${parsedEquipments.length} valid equipments in localStorage`);
        equipmentsInitialized = true;
      } else {
        console.warn("Equipment data exists but is empty or invalid. Reinitializing...");
        import('./data').then(({ equipments }) => {
          localStorage.setItem('checklistafm-equipments', JSON.stringify(equipments));
          console.log('Equipamentos recarregados com sucesso:', equipments.length);
          equipmentsInitialized = true;
          checkInitializationComplete();
        });
      }
    } catch (e) {
      console.error("Error parsing equipments in localStorage:", e);
      import('./data').then(({ equipments }) => {
        localStorage.setItem('checklistafm-equipments', JSON.stringify(equipments));
        console.log('Equipamentos recarregados com sucesso após erro');
        equipmentsInitialized = true;
        checkInitializationComplete();
      });
    }
    
    checkInitializationComplete();
  }
  
  // Verificar o estado atual do checklist
  if (!localStorage.getItem(CHECKLIST_STORE_KEY)) {
    console.log("No checklist state found, initializing with default state");
    localStorage.setItem(CHECKLIST_STORE_KEY, JSON.stringify(initialChecklistState));
  }

  if (!localStorage.getItem(CHECKLIST_TEMPLATE_KEY)) {
    console.log("No checklist template found, initializing default questions");
    import('./data').then(({ checklistItems }) => {
      const template = checklistItems.map(item => ({
        ...item,
        answer: null
      }));
      localStorage.setItem(CHECKLIST_TEMPLATE_KEY, JSON.stringify(template));
      console.log('Checklist questions initialized com sucesso:', template.length);
    }).catch(error => {
      console.error("Failed to initialize checklist template:", error);
    });
  }
  
  // Verificar configuração do banco de dados - removido pois agora usamos Supabase
  
  function checkInitializationComplete() {
    if (operatorsInitialized && equipmentsInitialized) {
      console.log("All data successfully initialized");
      localStorage.setItem(INITIAL_DATA_LOADED_KEY, 'true');
    }
  }
};
