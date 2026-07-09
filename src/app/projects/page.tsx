'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import ProjectCard from '@/components/projects/ProjectCard'
import AddProjectModal from '@/components/projects/AddProjectModal'
import { useAppStore } from '@/store/appStore'
import { Plus } from 'lucide-react'
import type { Project } from '@/types'

export default function ProjectsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const projects = useAppStore((s) => s.projects)


  const active = projects.filter((p) => p.status === 'active')
  const others = projects.filter((p) => p.status !== 'active')

  return (
    <AppShell title="Projects">
      <div className="anim-page space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Track budgets for construction, events, and other projects.</p>
          <button onClick={() => setAddOpen(true)} className="btn-primary">
            <Plus size={15} /> New Project
          </button>
        </div>

        {active.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Active</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {active.map((p) => (
                <ProjectCard key={p.id} project={p} onEdit={setEditProject} />
              ))}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Completed / Paused</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {others.map((p) => (
                <ProjectCard key={p.id} project={p} onEdit={setEditProject} />
              ))}
            </div>
          </div>
        )}

        {projects.length === 0 && (
          <div className="card py-16 text-center">
            <p className="text-slate-400 text-sm mb-4">No projects yet.</p>
            <button onClick={() => setAddOpen(true)} className="btn-primary mx-auto">
              <Plus size={15} /> Create your first project
            </button>
          </div>
        )}
      </div>

      <AddProjectModal
        open={addOpen || !!editProject}
        onClose={() => { setAddOpen(false); setEditProject(null) }}
        editProject={editProject}
      />
    </AppShell>
  )
}
