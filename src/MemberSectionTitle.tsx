const paths = {
  access: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21v-3a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v3z',
  health: 'M9 4H5v17h14V4h-4 M9 2h6v4H9z M8 11h8 M8 15h8',
  results: 'M4 21V13h4v8 M10 21V8h4v13 M16 21V3h4v18',
  training: 'M3 8v8 M6 5v14 M18 5v14 M21 8v8 M6 12h12',
}
export default function MemberSectionTitle({kind,children}:{kind:keyof typeof paths;children:string}) {
 return <span className="member-section-title"><span className="member-section-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]}/></svg></span><span>{children}</span></span>
}
