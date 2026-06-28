/**
 * AgentResult<T> is the standard return type for every agent method.
 *
 * It is a discriminated union — TypeScript will force every caller to check
 * `.success` before accessing `.data`. This makes error handling explicit
 * and prevents silent failures from propagating through the pipeline.
 *
 * Usage:
 *   const result = await ideaAgent.generateIdeas(context, []);
 *   if (!result.success) {
 *     // handle error — result.error is available here
 *   }
 *   // result.data is safely available here
 */
export type AgentResult<T> =
  | {
      success: true;
      data: T;
      agentName: string;
      durationMs: number;
    }
  | {
      success: false;
      error: string;
      agentName: string;
      durationMs: number;
    };

/**
 * PipelineRunStatus tracks the state of a full pipeline execution from trigger to delivery.
 */
export type PipelineRunStatus =
  | 'running'
  | 'awaiting_approval'
  | 'processing_script'
  | 'completed'
  | 'failed';

/**
 * PipelineRun is a record of one full execution of the pipeline.
 * Stored in the database so runs are inspectable from the dashboard.
 */
export interface PipelineRun {
  id: string;
  clientId: string;
  status: PipelineRunStatus;

  ideasGenerated: number;
  ideasApproved: number;
  scriptsGenerated: number;
  scriptsPassed: number;
  scriptsHeld: number;

  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
}
