import { type Analysis, analyze, type WarningCode } from './analyze';
import type { HostNode, Platform } from './tree';

export interface A11yReport {
  screen?: string;
  platform: Platform;
  elements: { index: number; announcement: string; role?: string; label: string }[];
  warnings: { code: WarningCode; message: string; index?: number }[];
}

function toReport(analysis: Analysis, screen?: string): A11yReport {
  return {
    ...(screen && { screen }),
    platform: analysis.platform,
    elements: analysis.elements.map(({ index, announcement, role, label }) => ({
      index,
      announcement,
      ...(role && { role }),
      label,
    })),
    warnings: analysis.warnings.map(({ code, message, index }) => ({
      code,
      message,
      ...(index !== undefined && { index }),
    })),
  };
}

/**
 * Reading order, announcements and warnings for a host tree. In tests pass RNTL's
 * `screen.toJSON()`:
 *
 * ```ts
 * expect(getA11yReport(screen.toJSON()).warnings).toEqual([]);
 * ```
 */
export function getA11yReport(
  tree: HostNode | HostNode[] | string | null,
  options: { platform?: Platform; screen?: string } = {},
): A11yReport {
  return toReport(analyze(tree, options.platform ?? 'ios'), options.screen);
}

/** The report as Markdown, for PR comments or a docs page. */
export function toMarkdown(report: A11yReport): string {
  const lines = [
    `## ${report.screen ?? 'Screen'} (${report.platform === 'ios' ? 'VoiceOver' : 'TalkBack'})`,
    '',
    '| # | Announcement |',
    '| --- | --- |',
    ...report.elements.map((e) => `| ${e.index} | ${e.announcement.replace(/\|/g, '\\|')} |`),
  ];
  if (report.warnings.length) {
    lines.push('', '### Warnings', '');
    for (const w of report.warnings) {
      lines.push(`- ${w.index !== undefined ? `#${w.index} ` : ''}\`${w.code}\`: ${w.message}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
