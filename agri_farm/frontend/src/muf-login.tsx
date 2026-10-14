import React from 'react';
export interface MufLoginScreenProps{children:React.ReactNode;className?:string;dir?:'ltr'|'rtl'}
export function MufLoginScreen({children,className='',dir}:MufLoginScreenProps){return <div className={`muf-login-screen ${className}`.trim()} dir={dir}>{children}</div>}
export interface MufLoginPanelProps{children:React.ReactNode;className?:string}
export function MufLoginPanel({children,className=''}:MufLoginPanelProps){return <section className={`muf-login-card ${className}`.trim()}>{children}</section>}
export interface MufLoginBrandProps{farmName:string;logoSrc:string;logoAlt:string;subtitle:string;fallbackSrc?:string}
export function MufLoginBrand({farmName,logoSrc,logoAlt,subtitle,fallbackSrc}:MufLoginBrandProps){return <header className="muf-login-brand"><div className="muf-login-logo-wrap"><img src={logoSrc} alt={logoAlt} className="muf-login-logo" onError={fallbackSrc?(event)=>{event.currentTarget.onerror=null;event.currentTarget.src=fallbackSrc}:undefined}/></div><h2 className="muf-login-title">{farmName}</h2><p className="muf-login-sub">{subtitle}</p></header>}
