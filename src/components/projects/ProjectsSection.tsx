'use client'

import { useState } from 'react'
import { Plus, FolderKanban } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ProjectCard from '@/components/projects/ProjectCard'
import AddProjectModal from '@/components/projects/AddProjectModal'
import type { Project } from '@/types'

const GRID: React.CSSProperties = {
  display: 'grid', gap: 'var(--row-gap)',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
}

const GROUP_LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
  color: 'var(--text-4)', margin: '0 0 10px',
}

export default function ProjectsSection() {
  const projects = useAppStore((s) => s.projects)
  const [addOpen, setAddOpen] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)

  const active = projects.filter((p) => p.status === 'active')
  const others = projects.filter((p) => p.status !== 'active')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Projects</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>Track what you're spending towards</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* Empty state */}
      {projects.length === 0 ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <FolderKanban size={26} style={{ color: 'var(--text-4)' }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No projects yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Add a budget — construction, wedding, any big one-off</p>
          <button onClick={() => setAddOpen(true)} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Create your first project
          </button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <h3 style={GROUP_LABEL}>Active</h3>
              <div style={GRID}>
                {active.map((p) => (
                  <ProjectCard key={p.id} project={p} onEdit={setEditProject} />
                ))}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              <h3 style={GROUP_LABEL}>Completed / Paused</h3>
              <div style={GRID}>
                {others.map((p) => (
                  <ProjectCard key={p.id} project={p} onEdit={setEditProject} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AddProjectModal
        open={addOpen || !!editProject}
        onClose={() => { setAddOpen(false); setEditProject(null) }}
        editProject={editProject}
      />
    </div>
  )
}
