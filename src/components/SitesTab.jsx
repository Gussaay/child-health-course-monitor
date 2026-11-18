// Admin > Sites (super users, main site only): choose which modules the
// EmONC and ch-sudan sites show. Saved in meta/siteSettings; each site reads
// it as it opens (hooks/useSiteSettings.js). See siteMode.js.
import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Globe, RotateCcw, Save } from 'lucide-react';
import { db, auth } from '../firebase';
import { Card, CardBody, CardFooter, Button, Spinner, Checkbox } from './CommonComponents';
import { MANAGED_SITES, SITE_MODULES, DEFAULT_SITE_MODULES, siteModulesFor, IS_EMONC_SITE, IS_CH_SITE } from '../siteMode';

const SETTINGS_DOC = ['meta', 'siteSettings'];

export default function SitesTab({ setToast }) {
    const { t } = useTranslation();
    const [saved, setSaved] = useState(undefined); // undefined: loading, null: never saved
    const [draft, setDraft] = useState({});
    const [savingSite, setSavingSite] = useState(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        let alive = true;
        getDoc(doc(db, ...SETTINGS_DOC))
            .then(snap => {
                if (!alive) return;
                const data = snap.exists() ? snap.data() : null;
                setSaved(data);
                setDraft(Object.fromEntries(MANAGED_SITES.map(s => [s.id, siteModulesFor(s.id, data)])));
            })
            .catch(() => { if (alive) { setLoadError(true); setSaved(null); } });
        return () => { alive = false; };
    }, []);

    const savedLists = useMemo(
        () => Object.fromEntries(MANAGED_SITES.map(s => [s.id, siteModulesFor(s.id, saved)])),
        [saved]
    );

    const toggle = (siteId, moduleId) => setDraft(d => {
        const list = new Set(d[siteId] || []);
        if (list.has(moduleId)) list.delete(moduleId); else list.add(moduleId);
        // Keep the list in the menu's order.
        return { ...d, [siteId]: SITE_MODULES.map(m => m.id).filter(id => list.has(id)) };
    });

    const save = async (siteId) => {
        setSavingSite(siteId);
        try {
            const modules = draft[siteId] || [];
            await setDoc(doc(db, ...SETTINGS_DOC), {
                sites: { [siteId]: { modules, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || '' } },
            }, { merge: true });
            setSaved(prev => ({ ...(prev || {}), sites: { ...(prev?.sites || {}), [siteId]: { modules } } }));
            setToast?.({ show: true, message: t('admin_pages.sites.saved', 'Saved. The site shows the new choice the next time it opens or refreshes.'), type: 'success' });
        } catch (err) {
            console.error('[Sites] save failed', err);
            setToast?.({ show: true, message: t('admin_pages.sites.save_failed', 'Could not save. Only super users can change sites.'), type: 'error' });
        } finally {
            setSavingSite(null);
        }
    };

    if (IS_EMONC_SITE || IS_CH_SITE) {
        return <p className="text-sm text-gray-600">{t('admin_pages.sites.main_only', 'Sites are managed from the main site.')}</p>;
    }
    if (saved === undefined) return <Spinner />;

    return (
        <div className="space-y-6">
            <p className="text-sm text-gray-600">
                {t('admin_pages.sites.intro', 'Choose which modules each site shows. The home page is always shown, and Admin is only on the main site. A user still needs the usual permission to open a module.')}
            </p>
            {loadError && (
                <p className="text-sm text-red-600">{t('admin_pages.sites.load_failed', 'Could not load the saved settings. The defaults are shown.')}</p>
            )}
            <div className="grid gap-6 md:grid-cols-2">
                {MANAGED_SITES.map(site => {
                    const list = new Set(draft[site.id] || []);
                    const changed = (draft[site.id] || []).join() !== (savedLists[site.id] || []).join();
                    const isSaved = Array.isArray(saved?.sites?.[site.id]?.modules);
                    return (
                        <Card key={site.id}>
                            <CardBody>
                                <div className="flex items-center gap-3 mb-1">
                                    <Globe className="w-5 h-5 text-sky-600" />
                                    <h3 className="text-lg font-semibold text-gray-800">{site.name}</h3>
                                </div>
                                <p className="text-xs text-gray-500 mb-4">
                                    {site.host} · {isSaved
                                        ? t('admin_pages.sites.using_saved', 'using the saved choice')
                                        : t('admin_pages.sites.using_default', 'using the default (nothing saved yet)')}
                                </p>
                                <div className="space-y-2">
                                    {SITE_MODULES.map(m => (
                                        <label key={m.id} className="flex items-center gap-3 text-sm text-gray-800 cursor-pointer">
                                            <Checkbox checked={list.has(m.id)} onChange={() => toggle(site.id, m.id)} />
                                            <span>{t(`admin_pages.sites.modules.${m.id}`, m.label)}</span>
                                        </label>
                                    ))}
                                </div>
                            </CardBody>
                            <CardFooter>
                                <Button variant="ghost" onClick={() => setDraft(d => ({ ...d, [site.id]: [...DEFAULT_SITE_MODULES[site.id]] }))}>
                                    <RotateCcw className="w-4 h-4" /> {t('admin_pages.sites.defaults', 'Defaults')}
                                </Button>
                                <Button onClick={() => save(site.id)} disabled={(!changed && isSaved) || savingSite === site.id}>
                                    {savingSite === site.id ? <Spinner size="sm" /> : <Save className="w-4 h-4" />} {t('admin_pages.sites.save', 'Save')}
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
