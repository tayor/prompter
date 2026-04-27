import { NextRequest, NextResponse } from 'next/server'
import { buildPrompterExportData } from '@/lib/services/import-export-service'
import yaml from 'js-yaml'

// GET /api/export - Export all prompts/workflows as JSON or YAML
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const format = searchParams.get('format') || 'json' // 'json' or 'yaml'
        const includePrompts = searchParams.get('prompts') !== 'false'
        const includeWorkflows = searchParams.get('workflows') !== 'false'
        const includeFolders = searchParams.get('folders') !== 'false'
        const includeTags = searchParams.get('tags') !== 'false'

        const exportData = await buildPrompterExportData({
            includePrompts,
            includeWorkflows,
            includeFolders,
            includeTags,
        })

        const dateStr = new Date().toISOString().split('T')[0]

        // Return as YAML or JSON
        if (format === 'yaml') {
            const yamlContent = yaml.dump(exportData, {
                indent: 2,
                lineWidth: 120,
                noRefs: true,
            })
            return new NextResponse(yamlContent, {
                headers: {
                    'Content-Type': 'text/yaml',
                    'Content-Disposition': `attachment; filename="prompter-export-${dateStr}.yaml"`,
                },
            })
        }

        // Default: JSON
        return new NextResponse(JSON.stringify(exportData, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="prompter-export-${dateStr}.json"`,
            },
        })
    } catch (error) {
        console.error('Export failed:', error)
        return NextResponse.json({ error: 'Export failed' }, { status: 500 })
    }
}
