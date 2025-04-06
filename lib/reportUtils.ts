import ReactDOMServer from 'react-dom/server';
import React from 'react';
import ProjectFinancialReport, { ProjectReportData } from '@/components/projects/ProjectFinancialReport';

export const generateAndDownloadHtmlReport = (
    reportData: ProjectReportData,
    projectId: string
) => {
    // 1. Render the React component to a static HTML string
    const reportHtmlString = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProjectFinancialReport, { data: reportData })
    );

    // 2. Construct the full HTML document
    // Note: Basic styles are inline in the component itself for now.
    // Including Tailwind would require more complex setup (e.g., inlining used styles).
    const fullHtml = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Финансовый отчет по проекту ${reportData.project.name || projectId}</title>
            <style>
                /* Minimal reset and body styles - relies on component inline styles */
                body { margin: 0; padding: 0; font-family: sans-serif; }
            </style>
        </head>
        <body>
            ${reportHtmlString}
        </body>
        </html>
    `;

    // 3. Create a Blob
    const blob = new Blob([fullHtml], { type: 'text/html' });

    // 4. Create a temporary download link and trigger click
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financial-report-project-${reportData.project.number || projectId}.html`;
    document.body.appendChild(link);
    link.click();

    // 5. Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}; 