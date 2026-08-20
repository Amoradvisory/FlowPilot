import { createContext } from 'svelte';
import type { TeacherFlowState } from './teacherflow-state.svelte';

export const [getTeacherFlowState, setTeacherFlowState] = createContext<TeacherFlowState>();
