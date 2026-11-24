// Child Health Library: national training material, guidelines, protocols,
// operational guides and SOPs, organised by child health service.
//
//   first page   the child health services, as tiles (like the Courses page)
//   service      its three sub-categories: Training, Guidelines & Protocols,
//                Operational Guides & SOP
//   category     the content cards: photo, name, description and an Open button
//
// Open to everyone, signed in or not (/public/library). Federal managers and
// super users add, edit and remove content: name, description, a photo
// (uploaded or a direct link) and the content (an uploaded file or a link).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Activity, Baby, Bell, BookOpen, ClipboardList, ExternalLink, FileText, GraduationCap, HeartPulse,
    Home, Library, Link2, Pencil, Plus, ScrollText, Search, Share2, Shield, Siren, Trash2, Upload, Users,
} from 'lucide-react';
import {
    Button, Card, EmptyState, MenuGrid, MenuTile, Modal, PageHeader, SkeletonCard, Spinner, useInPageBack,
} from '../CommonComponents';
import { notify, confirmDialog } from '../dialogs';
import {
    LIBRARY_CATEGORIES, LIBRARY_SERVICES, LIBRARY_FILE_TYPES, LIBRARY_IMAGE_TYPES,
    LIBRARY_ERROR_TEXT, canManageLibrary, countBy, isDraftItem, itemsFor, libraryPath, validateLibraryItem,
} from './libraryModel';
import { shareLibraryLink } from './libraryShare';
import {
    addLibraryItem, addLibraryRequest, deleteLibraryItem, listLibraryItems, listLibraryRequests, removeLibraryFile, updateLibraryItem, uploadLibraryFile,
} from './libraryData';

const SERVICE_ICONS = {
    IMNCI: Activity, ICCM: Home, ETAT: Siren, EENC: Baby, EmONC: HeartPulse, 'Small & Sick Newborn': Baby,
    IPC: Shield, 'Comprehensive Package For Community Midwives': Users, 'Program Management': ClipboardList,
};
const CATEGORY_ICONS = { training: GraduationCap, guidelines: ScrollText, operational: BookOpen };

function useLibraryText() {
    const { t } = useTranslation();
    const serviceShort = (s) => t(`library.services.short.${s.titleKey}`, s.short);
    const serviceTitle = (s) => t(`library.services.${s.titleKey}`, s.title);
    const categoryLabel = (c) => t(`library.categories.${c.key}`, c.label);
    const categoryHint = (c) => t(`library.categories.${c.key}_hint`, c.hint);
    return { t, serviceShort, serviceTitle, categoryLabel, categoryHint };
}

// The Share button on every level and every card: the link opens without sign-in.
function useShare() {
    const { t } = useTranslation();
    return async (target, title) => {
        const result = await shareLibraryLink(target, { title });
        if (result === 'copied') notify(t('library.link_copied', 'Link copied. Anyone can open it without signing in.'), 'success');
        else if (result === 'failed') notify(t('library.share_failed', 'Could not share the link.'), 'error');
    };
}

function ShareButton({ onClick, compact = false }) {
    const { t } = useTranslation();
    const label = t('library.share', 'Share link');
    return (
        <Button variant="ghost" onClick={onClick} className={compact ? '!px-3' : ''}>
            <Share2 size={16} /> {compact ? <span className="sr-only">{label}</span> : label}
        </Button>
    );
}

// `initial`: where a shared link opens ({ service, category, itemId }).
// `syncAddress`: keep the browser address on the level shown, so the address
// bar itself is always a link to share (the public page only).
export default function ChildHealthLibraryView({ permissions, user, onBack, isPublic = false, initial = null, syncAddress = false }) {
    const { t, serviceShort, serviceTitle, categoryLabel, categoryHint } = useLibraryText();
    const canManage = !isPublic && canManageLibrary(permissions);

    const [items, setItems] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [service, setService] = useState(initial?.service || null);
    const [category, setCategory] = useState(initial?.category || null);
    const [itemId, setItemId] = useState(initial?.itemId || null);
    const share = useShare();
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(null); // null | {} (new) | item
    const [notifyItem, setNotifyItem] = useState(null); // draft item a visitor is registering for
    const [requests, setRequests] = useState([]);

    const load = useCallback(async () => {
        setLoadError('');
        try {
            setItems(await listLibraryItems());
        } catch (error) {
            console.error('Library load failed:', error);
            setLoadError(error?.message || 'Could not load the library.');
            setItems((prev) => prev || []);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    // Managers see how many people are waiting for each draft item.
    useEffect(() => {
        if (!canManage) return;
        let alive = true;
        listLibraryRequests().then((list) => { if (alive) setRequests(list); }).catch(() => {});
        return () => { alive = false; };
    }, [canManage]);
    const waitingByItem = useMemo(() => {
        const out = {};
        requests.forEach((r) => { if (!r.notifiedAt) out[r.itemId] = (out[r.itemId] || 0) + 1; });
        return out;
    }, [requests]);

    // A single shared item: once loaded, the levels above it are its own
    // service and section, so Back walks up from there.
    const openItem = useMemo(() => (itemId && items ? items.find((it) => it.id === itemId) || null : null), [itemId, items]);
    useEffect(() => {
        if (openItem) { setService(openItem.service); setCategory(openItem.category); }
    }, [openItem]);

    useEffect(() => {
        if (!syncAddress) return;
        const path = libraryPath({ service, category, itemId });
        if (window.location.pathname !== path) window.history.replaceState(window.history.state, '', path);
    }, [syncAddress, service, category, itemId]);

    const goUp = useCallback(() => {
        setSearch('');
        if (itemId) setItemId(null);
        else if (category) setCategory(null);
        else if (service) setService(null);
        else onBack?.();
    }, [itemId, category, service, onBack]);
    // The Android top-bar arrow and the phone's back button step back inside the library first.
    useInPageBack(goUp, !!(service || itemId));

    const serviceObj = LIBRARY_SERVICES.find((s) => s.key === service);
    const categoryObj = LIBRARY_CATEGORIES.find((c) => c.key === category);
    const serviceCounts = useMemo(() => countBy(items, 'service'), [items]);
    const categoryCounts = useMemo(() => countBy(items, 'category', service), [items, service]);
    const shown = useMemo(() => (service && category ? itemsFor(items, service, category, search) : []), [items, service, category, search]);

    const onDelete = async (item) => {
        const ok = await confirmDialog(t('library.delete_confirm', 'Remove "{{name}}" from the library?', { name: item.name }), { danger: true, confirmLabel: t('library.delete', 'Remove') });
        if (!ok) return;
        try {
            await deleteLibraryItem(item);
            setItems((prev) => (prev || []).filter((it) => it.id !== item.id));
            if (itemId === item.id) setItemId(null);
            notify(t('library.deleted', 'Removed from the library.'), 'success');
        } catch (error) {
            notify(t('library.save_failed', 'Could not save: {{message}}', { message: error?.message || '' }), 'error');
        }
    };

    const onSaved = (saved) => {
        setItems((prev) => {
            const list = prev || [];
            return list.some((it) => it.id === saved.id) ? list.map((it) => (it.id === saved.id ? { ...it, ...saved } : it)) : [saved, ...list];
        });
        setEditing(null);
    };

    const addButton = canManage ? (
        <Button onClick={() => setEditing({})}><Plus size={16} /> {t('library.add', 'Add content')}</Button>
    ) : null;

    let body;
    if (items === null) {
        body = <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
    } else if (itemId) {
        body = openItem ? (
            <>
                <PageHeader
                    title={openItem.name}
                    subtitle={[serviceObj && serviceTitle(serviceObj), categoryObj && categoryLabel(categoryObj)].filter(Boolean).join(' · ')}
                    onBack={goUp}
                />
                <div className="mx-auto max-w-xl">
                    <LibraryCard item={openItem} large canManage={canManage} waiting={waitingByItem[openItem.id] || 0} onNotify={() => setNotifyItem(openItem)} onShare={() => share({ itemId: openItem.id }, openItem.name)} onEdit={() => setEditing(openItem)} onDelete={() => onDelete(openItem)} />
                    <div className="mt-4 text-center">
                        <Button variant="secondary" onClick={() => setItemId(null)} className="mx-auto">
                            <Library size={16} /> {t('library.more_in_section', 'More in this section')}
                        </Button>
                    </div>
                </div>
            </>
        ) : (
            <EmptyState
                icon={Library}
                message={t('library.item_missing', 'This item is no longer in the library.')}
                action={{ label: t('library.browse', 'Browse the library'), onClick: () => { setItemId(null); setService(null); setCategory(null); } }}
            />
        );
    } else if (!service) {
        body = (
            <>
                <PageHeader
                    title={t('library.title', 'Child Health Library')}
                    subtitle={t('library.subtitle', 'Training materials, guidelines, protocols, operational guides and SOPs for each child health service.')}
                    onBack={onBack}
                    actions={<>{addButton}<ShareButton onClick={() => share({}, t('library.title', 'Child Health Library'))} /></>}
                />
                <MenuGrid columns="sm:grid-cols-3 lg:grid-cols-4">
                    {LIBRARY_SERVICES.map((s) => (
                        <MenuTile
                            key={s.key}
                            icon={SERVICE_ICONS[s.key] || Library}
                            label={serviceShort(s)}
                            title={serviceTitle(s)}
                            hint={t('library.n_items', '{{count}} items', { count: serviceCounts[s.key] || 0 })}
                            onClick={() => setService(s.key)}
                        />
                    ))}
                </MenuGrid>
            </>
        );
    } else if (!category) {
        body = (
            <>
                <PageHeader title={serviceTitle(serviceObj)} subtitle={t('library.choose_category', 'Choose a section.')} onBack={goUp} actions={<>{addButton}<ShareButton onClick={() => share({ service }, `${t('library.title', 'Child Health Library')}: ${serviceTitle(serviceObj)}`)} /></>} />
                <MenuGrid columns="sm:grid-cols-3">
                    {LIBRARY_CATEGORIES.map((c) => (
                        <MenuTile
                            key={c.key}
                            icon={CATEGORY_ICONS[c.key]}
                            label={categoryLabel(c)}
                            title={categoryHint(c)}
                            hint={t('library.n_items', '{{count}} items', { count: categoryCounts[c.key] || 0 })}
                            onClick={() => setCategory(c.key)}
                        />
                    ))}
                </MenuGrid>
            </>
        );
    } else {
        body = (
            <>
                <PageHeader title={categoryLabel(categoryObj)} subtitle={serviceTitle(serviceObj)} onBack={goUp} actions={<>{addButton}<ShareButton onClick={() => share({ service, category }, `${serviceShort(serviceObj)}: ${categoryLabel(categoryObj)}`)} /></>} />
                <div className="relative mb-4">
                    <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('library.search', 'Search this section')}
                        className="w-full rounded-lg border border-slate-300 py-2 ps-9 pe-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                </div>
                {shown.length === 0 ? (
                    <EmptyState
                        icon={search ? undefined : Library}
                        filtered={!!search}
                        message={search ? t('library.no_match', 'Nothing matches your search.') : t('library.empty', 'No content has been added to this section yet.')}
                        action={canManage && !search ? { label: t('library.add', 'Add content'), onClick: () => setEditing({}) } : undefined}
                    />
                ) : (
                    <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {shown.map((item) => (
                            <LibraryCard key={item.id} item={item} canManage={canManage} waiting={waitingByItem[item.id] || 0} onNotify={() => setNotifyItem(item)} onShare={() => share({ itemId: item.id }, item.name)} onEdit={() => setEditing(item)} onDelete={() => onDelete(item)} />
                        ))}
                    </div>
                )}
            </>
        );
    }

    return (
        <Card className="p-3 md:p-6">
            {loadError && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex flex-wrap items-center justify-between gap-2">
                    <span>{t('library.load_failed', 'Could not load the library.')} {loadError}</span>
                    <Button variant="secondary" onClick={load}>{t('library.retry', 'Try again')}</Button>
                </div>
            )}
            {body}
            {notifyItem && (
                <LibraryNotifyForm item={notifyItem} onClose={() => setNotifyItem(null)} />
            )}
            {editing && (
                <LibraryItemForm
                    item={editing.id ? editing : null}
                    defaults={{ service: service || LIBRARY_SERVICES[0].key, category: category || LIBRARY_CATEGORIES[0].key }}
                    user={user}
                    onClose={() => setEditing(null)}
                    onSaved={onSaved}
                />
            )}
        </Card>
    );
}

function LibraryCard({ item, canManage, onShare, onEdit, onDelete, onNotify, waiting = 0, large = false }) {
    const { t } = useTranslation();
    const [imageFailed, setImageFailed] = useState(false);
    const draft = isDraftItem(item);
    const open = () => { if (!draft && item.linkUrl) window.open(item.linkUrl, '_blank', 'noopener,noreferrer'); };
    // One fixed thumbnail size for every book, in every card, so the list
    // lines up whatever shape the photo is. The single-item card's is bigger,
    // but just as fixed.
    const thumbSize = large ? 'h-40 w-[7.5rem]' : 'h-28 w-20';
    const thumbInner = (
        <>
            {item.imageUrl && !imageFailed ? (
                <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
            ) : (
                <span className="flex h-full w-full items-center justify-center text-sky-400"><FileText size={large ? 40 : 30} strokeWidth={1.5} /></span>
            )}
            {draft && <span className="absolute start-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{t('library.draft_badge', 'Draft')}</span>}
        </>
    );
    return (
        <article className="flex gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:gap-4 md:p-4">
            {draft ? (
                <div className={`relative shrink-0 overflow-hidden rounded-lg bg-slate-100 ${thumbSize}`}>{thumbInner}</div>
            ) : (
                <button type="button" onClick={open} disabled={!item.linkUrl} className={`relative shrink-0 overflow-hidden rounded-lg bg-slate-100 ${thumbSize}`} aria-label={item.name}>{thumbInner}</button>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h3 className="text-base font-bold leading-snug text-slate-800">{item.name}</h3>
                {item.description && <p className={`text-sm leading-relaxed text-slate-600 whitespace-pre-line ${large ? '' : 'line-clamp-5'}`}>{item.description}</p>}
                {draft && <p className="text-sm leading-relaxed text-amber-700">{t('library.draft_note', 'This book is still being prepared, so it cannot be opened yet. Leave your email address and we will send it to you as soon as it is final.')}</p>}
                {canManage && waiting > 0 && <p className="text-xs font-semibold text-slate-500">{t('library.waiting', '{{count}} people waiting for this book', { count: waiting })}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                    {draft ? (
                        <Button onClick={onNotify}><Bell size={16} /> {t('library.notify_me', 'Notify me')}</Button>
                    ) : (
                        <Button onClick={open} disabled={!item.linkUrl}><ExternalLink size={16} /> {t('library.open', 'Open')}</Button>
                    )}
                    {onShare && <ShareButton onClick={onShare} compact={!large} />}
                    {canManage && (
                        <>
                            <Button variant="ghost" onClick={onEdit}><Pencil size={16} /> {t('library.edit', 'Edit')}</Button>
                            <Button variant="ghost" onClick={onDelete} className="!text-red-700"><Trash2 size={16} /> {t('library.delete', 'Remove')}</Button>
                        </>
                    )}
                </div>
            </div>
        </article>
    );
}

// "Notify me" for a draft item: a visitor leaves their name and email
// address, and the server emails them the book when it becomes final
// (functions/libraryNotify.js). No account is needed, like the library
// itself; firestore.rules checks the fields of the registration.
function LibraryNotifyForm({ item, onClose }) {
    const { t, i18n } = useTranslation();
    const [form, setForm] = useState({ name: '', email: '', phone: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);
    const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

    const submit = async () => {
        const name = form.name.trim();
        const email = form.email.trim();
        if (!name) { setError(t('library.notify.name_required', 'Enter your name.')); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t('library.notify.email_invalid', 'Enter a valid email address.')); return; }
        setSaving(true);
        setError('');
        try {
            await addLibraryRequest(item.id, { name, email, phone: form.phone, lang: i18n.language?.startsWith('ar') ? 'ar' : 'en' });
            setDone(true);
        } catch (err) {
            console.error('Library notify registration failed:', err);
            setError(t('library.notify.failed', 'Could not save your request. Please try again.'));
        } finally {
            setSaving(false);
        }
    };

    const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';
    const label = 'block text-sm font-semibold text-slate-700 mb-1';

    return (
        <Modal isOpen onClose={saving ? () => {} : onClose} title={t('library.notify.title', 'Get this book by email')}>
            {done ? (
                <div className="space-y-4 p-4 md:p-6">
                    <p className="text-sm leading-relaxed text-slate-700">{t('library.notify.done', 'You are on the list. We will email "{{name}}" to {{email}} as soon as it is final.', { name: item.name, email: form.email.trim() })}</p>
                    <div className="flex justify-end">
                        <Button onClick={onClose}>{t('library.close', 'Close')}</Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 p-4 md:p-6">
                    <p className="text-sm leading-relaxed text-slate-600">{t('library.notify.text', '"{{name}}" is still being prepared. Leave your details and we will email you the book as soon as it is final.', { name: item.name })}</p>
                    <div>
                        <label className={label} htmlFor="lib-notify-name">{t('library.notify.name', 'Your name')}</label>
                        <input id="lib-notify-name" className={field} value={form.name} onChange={set('name')} maxLength={200} autoComplete="name" />
                    </div>
                    <div>
                        <label className={label} htmlFor="lib-notify-email">{t('library.notify.email', 'Email address')}</label>
                        <input id="lib-notify-email" type="email" dir="ltr" className={field} value={form.email} onChange={set('email')} maxLength={200} autoComplete="email" />
                    </div>
                    <div>
                        <label className={label} htmlFor="lib-notify-phone">{t('library.notify.phone', 'Phone (optional)')}</label>
                        <input id="lib-notify-phone" type="tel" dir="ltr" className={field} value={form.phone} onChange={set('phone')} maxLength={40} autoComplete="tel" />
                    </div>
                    {error && <p className="text-xs font-semibold text-red-600" role="alert">⚠ {error}</p>}
                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                        <Button variant="secondary" onClick={onClose} disabled={saving}>{t('library.cancel', 'Cancel')}</Button>
                        <Button onClick={submit} disabled={saving}>{saving ? <Spinner size="sm" /> : <Bell size={16} />} {t('library.notify.submit', 'Notify me')}</Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

// Upload / direct-link switch for the photo and for the content.
function SourceSwitch({ value, onChange, uploadLabel, linkLabel }) {
    const btn = (mode, Icon, label) => (
        <button
            type="button"
            onClick={() => onChange(mode)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${value === mode ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
        >
            <Icon size={15} /> {label}
        </button>
    );
    return (
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {btn('upload', Upload, uploadLabel)}
            {btn('link', Link2, linkLabel)}
        </div>
    );
}

function LibraryItemForm({ item, defaults, user, onClose, onSaved }) {
    const { t, serviceShort, categoryLabel } = useLibraryText();
    const [form, setForm] = useState(() => ({
        service: item?.service || defaults.service,
        category: item?.category || defaults.category,
        name: item?.name || '',
        description: item?.description || '',
        status: item?.status === 'draft' ? 'draft' : 'final',
        imageMode: item?.imageUrl && !item?.imagePath ? 'link' : 'upload',
        imageLink: item?.imagePath ? '' : (item?.imageUrl || ''),
        imageFile: null,
        removeImage: false,
        contentMode: item?.linkUrl && !item?.filePath ? 'link' : 'upload',
        contentLink: item?.filePath ? '' : (item?.linkUrl || ''),
        contentFile: null,
        existingLinkUrl: item?.filePath ? item.linkUrl : '',
    }));
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));
    const pickFile = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.files?.[0] || null }));

    const previewUrl = useMemo(() => (form.imageFile ? URL.createObjectURL(form.imageFile) : ''), [form.imageFile]);
    useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
    const currentUploadedImage = item?.imagePath && !form.removeImage ? item.imageUrl : '';
    const imagePreview = form.imageMode === 'upload' ? (previewUrl || currentUploadedImage) : form.imageLink;

    const save = async () => {
        const { errors: found, item: clean } = validateLibraryItem(form);
        setErrors(found);
        if (Object.keys(found).length) return;
        setSaving(true);
        const uploaded = [];
        try {
            const record = { ...clean, imagePath: '', filePath: '', fileName: '' };
            // Photo: a new upload, the one already uploaded, or a link (or none).
            if (form.imageMode === 'upload') {
                if (form.imageFile) {
                    const up = await uploadLibraryFile(form.imageFile, 'image');
                    uploaded.push(up.path);
                    Object.assign(record, { imageUrl: up.url, imagePath: up.path });
                } else if (currentUploadedImage) {
                    Object.assign(record, { imageUrl: item.imageUrl, imagePath: item.imagePath });
                }
            }
            // Content: a new upload, the file already uploaded, or a link.
            if (form.contentMode === 'upload') {
                if (form.contentFile) {
                    const up = await uploadLibraryFile(form.contentFile, 'file');
                    uploaded.push(up.path);
                    Object.assign(record, { linkUrl: up.url, filePath: up.path, fileName: form.contentFile.name });
                } else {
                    Object.assign(record, { linkUrl: item?.linkUrl || '', filePath: item?.filePath || '', fileName: item?.fileName || '' });
                }
            }

            let id = item?.id;
            if (id) await updateLibraryItem(id, record, user);
            else id = await addLibraryItem(record, user);

            // Old uploads this save replaced are no longer used.
            if (item?.imagePath && item.imagePath !== record.imagePath) removeLibraryFile(item.imagePath);
            if (item?.filePath && item.filePath !== record.filePath) removeLibraryFile(item.filePath);

            notify(t('library.saved', 'Saved to the library.'), 'success');
            onSaved({ ...item, ...record, id, createdAt: item?.createdAt || { seconds: Date.now() / 1000 } });
        } catch (error) {
            console.error('Library save failed:', error);
            uploaded.forEach((p) => removeLibraryFile(p));
            notify(t('library.save_failed', 'Could not save: {{message}}', { message: error?.message || '' }), 'error');
        } finally {
            setSaving(false);
        }
    };

    const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';
    const label = 'block text-sm font-semibold text-slate-700 mb-1';
    const err = (key) => errors[key] ? <p className="mt-1 text-xs font-semibold text-red-600" role="alert">⚠ {t(`library.errors.${errors[key]}`, LIBRARY_ERROR_TEXT[errors[key]])}</p> : null;
    const fileInput = 'block w-full text-sm text-slate-600 file:me-3 file:rounded-full file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-sky-700 hover:file:bg-sky-100';

    return (
        <Modal isOpen onClose={saving ? () => {} : onClose} title={item ? t('library.edit_title', 'Edit library content') : t('library.add_title', 'Add library content')}>
            <div className="space-y-4 p-4 md:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className={label} htmlFor="lib-service">{t('library.form.service', 'Service')}</label>
                        <select id="lib-service" className={field} value={form.service} onChange={set('service')}>
                            {LIBRARY_SERVICES.map((s) => <option key={s.key} value={s.key}>{serviceShort(s)}</option>)}
                        </select>
                        {err('service')}
                    </div>
                    <div>
                        <label className={label} htmlFor="lib-category">{t('library.form.category', 'Section')}</label>
                        <select id="lib-category" className={field} value={form.category} onChange={set('category')}>
                            {LIBRARY_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{categoryLabel(c)}</option>)}
                        </select>
                        {err('category')}
                    </div>
                </div>

                <div>
                    <label className={label} htmlFor="lib-name">{t('library.form.name', 'Name')}</label>
                    <input id="lib-name" className={field} value={form.name} onChange={set('name')} maxLength={200} />
                    {err('name')}
                </div>

                <div>
                    <label className={label} htmlFor="lib-description">{t('library.form.description', 'Description')}</label>
                    <textarea id="lib-description" className={field} rows={4} value={form.description} onChange={set('description')} maxLength={3000} />
                    {err('description')}
                </div>

                <div>
                    <label className={label} htmlFor="lib-status">{t('library.form.status', 'Status')}</label>
                    <select id="lib-status" className={field} value={form.status} onChange={set('status')}>
                        <option value="final">{t('library.form.status_final', 'Final — everyone can open it')}</option>
                        <option value="draft">{t('library.form.status_draft', 'Draft — shown, but cannot be opened yet')}</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">{form.status === 'draft'
                        ? t('library.form.status_draft_hint', 'A draft appears in the library with its photo and description, but nobody can open it. Visitors can leave their email address, and the book is emailed to them automatically when you save it as final. Its content file can be added later.')
                        : t('library.form.status_final_hint', 'A final item can be opened by everyone.')}</p>
                </div>

                <div className="space-y-2">
                    <span className={label}>{t('library.form.photo', 'Photo')}</span>
                    <SourceSwitch value={form.imageMode} onChange={set('imageMode')} uploadLabel={t('library.form.upload', 'Upload')} linkLabel={t('library.form.direct_link', 'Direct link')} />
                    {form.imageMode === 'upload' ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <input type="file" accept={LIBRARY_IMAGE_TYPES.join(',')} onChange={pickFile('imageFile')} className={fileInput} />
                            {currentUploadedImage && !form.imageFile && (
                                <button type="button" className="text-xs font-semibold text-red-700 hover:underline" onClick={() => setForm((f) => ({ ...f, removeImage: true }))}>
                                    {t('library.form.remove_photo', 'Remove photo')}
                                </button>
                            )}
                        </div>
                    ) : (
                        <input type="url" inputMode="url" dir="ltr" className={field} placeholder="https://..." value={form.imageLink} onChange={set('imageLink')} />
                    )}
                    {imagePreview && <img src={imagePreview} alt="" className="h-32 w-full rounded-lg border border-slate-200 object-cover" />}
                    <p className="text-xs text-slate-500">{t('library.form.photo_hint', 'Optional. PNG, JPEG, WebP or GIF, up to 5 MB.')}</p>
                    {err('image')}
                </div>

                <div className="space-y-2">
                    <span className={label}>{t('library.form.content', 'Content')}</span>
                    <SourceSwitch value={form.contentMode} onChange={set('contentMode')} uploadLabel={t('library.form.upload_file', 'Upload file')} linkLabel={t('library.form.direct_link', 'Direct link')} />
                    {form.contentMode === 'upload' ? (
                        <>
                            <input type="file" accept={LIBRARY_FILE_TYPES.join(',')} onChange={pickFile('contentFile')} className={fileInput} />
                            {form.existingLinkUrl && !form.contentFile && (
                                <p className="text-xs text-slate-600">{t('library.form.current_file', 'Current file: {{name}}', { name: item?.fileName || '' })}</p>
                            )}
                            <p className="text-xs text-slate-500">{t('library.form.file_hint', 'PDF, Word, PowerPoint, Excel, MP4 video or image, up to 50 MB.')}</p>
                        </>
                    ) : (
                        <input type="url" inputMode="url" dir="ltr" className={field} placeholder="https://..." value={form.contentLink} onChange={set('contentLink')} />
                    )}
                    {err('content')}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>{t('library.cancel', 'Cancel')}</Button>
                    <Button onClick={save} disabled={saving}>{saving ? <Spinner size="sm" /> : null} {t('library.save', 'Save')}</Button>
                </div>
            </div>
        </Modal>
    );
}

