const paths = {
  access: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21v-3a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v3z',
  health: 'M9 4H5v17h14V4h-4 M9 2h6v4H9z M8 11h8 M8 15h8',
  results: 'M4 21V13h4v8 M10 21V8h4v13 M16 21V3h4v18',
  training: 'M2 10v4 M22 10v4 M3 8h3v8H3z M6 5h3v14H6z M9 11h6v2H9z M15 5h3v14h-3z M18 8h3v8h-3z',
}
export default function MemberSectionTitle({kind,children}:{kind:keyof typeof paths;children:string}) {
 return <span className="member-section-title"><span className="member-section-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]}/></svg></span><span>{children}</span></span>
}
