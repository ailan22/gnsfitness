import type { ReactNode } from 'react'

export default function MemberWorkspace({ name, children }: { name: string; children: ReactNode }) {
  return <>
    <div className="member-workspace">
        <div className="member-workspace-identity"><span className="member-initials" aria-hidden="true">{name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</span><h2>{name}</h2></div>
      <div className="member-workspace-content">{children}</div>
    </div>
    <p className="member-workspace-signature">GYM NATURE SOUL</p>
  </>
}
