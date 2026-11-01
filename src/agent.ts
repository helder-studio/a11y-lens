import { toMarkdown } from './core/report';
import type { Platform } from './core/tree';
import { a11yLens } from './lens';

/** Shape of Rozenite's `useRozeniteInAppAgentTool({ domain, tool, handler })`, without the dependency. */
export interface AgentTool {
  tool: { name: string; description: string; inputSchema: Record<string, unknown> };
  handler: (input: Record<string, unknown>) => unknown;
}

/** Lets an agent read the accessibility of the screen that's open right now. */
export const a11yAgentTools: AgentTool[] = [
  {
    tool: {
      name: 'a11y-scan',
      description:
        'Scan the current screen: predicted screen-reader order, announcements and accessibility warnings, as Markdown.',
      inputSchema: {
        type: 'object',
        properties: { platform: { type: 'string', enum: ['ios', 'android'] } },
      },
    },
    handler: async ({ platform }) => {
      if (platform === 'ios' || platform === 'android') a11yLens.setPlatform(platform as Platform);
      const analysis = await a11yLens.scan();
      return toMarkdown({
        platform: analysis.platform,
        elements: analysis.elements.map(({ index, announcement, label }) => ({
          index,
          announcement,
          label,
        })),
        warnings: analysis.warnings.map(({ code, message, index }) => ({
          code,
          message,
          ...(index !== undefined && { index }),
        })),
      });
    },
  },
  {
    tool: {
      name: 'a11y-overlay',
      description: 'Show or hide the numbered reading-order overlay on the device.',
      inputSchema: {
        type: 'object',
        properties: { show: { type: 'boolean' } },
        required: ['show'],
      },
    },
    handler: ({ show }) => {
      a11yLens.showOverlay(show === true);
      return { showOverlay: show === true };
    },
  },
];
