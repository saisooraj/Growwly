import { redirect } from 'next/navigation'

// Projects now live on the Goals page — keep old links and bookmarks working.
export default function ProjectsPage() {
  redirect('/goals')
}
