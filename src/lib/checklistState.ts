
import { ChecklistFormState, initialChecklistState, CHECKLIST_STORE_KEY } from "./types";

// Salvar o estado no localStorage
export const saveChecklistState = (state: Partial<ChecklistFormState>) => {
  const currentState = getChecklistState();
  const newState = { ...currentState, ...state };
  localStorage.setItem(CHECKLIST_STORE_KEY, JSON.stringify(newState));
  return newState;
};

// Obter o estado do localStorage
export const getChecklistState = (): ChecklistFormState => {
  const storedState = localStorage.getItem(CHECKLIST_STORE_KEY);
  if (!storedState) {
    return initialChecklistState;
  }
  
  try {
    const parsedState = JSON.parse(storedState);
    // Ensure checklist is always an array even if it's missing in localStorage
    if (!parsedState.checklist) {
      parsedState.checklist = [];
    }
    return parsedState;
  } catch (e) {
    console.error('Error parsing checklist state:', e);
    return initialChecklistState;
  }
};

// Limpar o estado
export const clearChecklistState = () => {
  localStorage.removeItem(CHECKLIST_STORE_KEY);
};

// Verificar se uma etapa está completa
export const isStepComplete = (step: 'operator' | 'equipment' | 'items' | 'media' | 'signature'): boolean => {
  const state = getChecklistState();
  
  switch (step) {
    case 'operator':
      return state.operator !== null;
    case 'equipment':
      return state.equipment !== null;
    case 'items':
      // Add null check for checklist array
      return state.checklist && state.checklist.length > 0 && 
             state.checklist.every(item => item.answer !== null && item.answer !== 'Selecione');
    case 'media':
      return true; // Fotos e comentários são opcionais
    case 'signature':
      return state.signature !== null;
    default:
      return false;
  }
};
