import React, { useMemo, useState } from 'react';
import { FiHash, FiX } from 'react-icons/fi';
import { useNotification } from '@shared/context/notification';
import { useLocalization } from '@shared/context/localization';
import { notificationType } from '@shared/utils/constants';
import { Loader } from '@shared/components/Common';
import { BTN_SUBMIT_CLASS } from '@shared/utils/layoutClasses';
import {
  TagCatalog,
  TagMap,
  TagMode,
  catalogSignature,
  cloneTagMap,
  defaultTagMap,
  hasAnyTag,
  normalizeTagInput,
  tagGroups,
} from '../../tags/catalog';
import { saveTagCatalog, useTagCatalogState } from '../../tags/store';

const fieldClass =
  'w-full py-3 px-4 bg-app-surface border border-app-subtle rounded-lg text-app-primary text-sm font-normal transition-all outline-none focus:border-[var(--color-app-accent)]/50 focus:bg-[var(--color-app-accent)]/5 [&_option]:bg-[var(--color-app-bg)] [&_option]:text-app-primary';

const secondaryBtn =
  'rounded-lg border border-white/10 px-3 py-2 text-sm text-app-secondary hover:bg-white/5 disabled:opacity-50 cursor-pointer';

const modeBtn = (active: boolean) =>
  `h-9 rounded-lg border text-sm transition-colors cursor-pointer ${
    active
      ? 'border-[var(--color-app-accent)] bg-white/[0.08] text-app-primary font-semibold'
      : 'border-transparent bg-transparent text-app-muted hover:text-app-secondary'
  }`;

const TagEditor = ({ initial }: { initial: TagCatalog }) => {
  const showNotification = useNotification();
  const { t } = useLocalization();
  const groups = useMemo(() => tagGroups(), []);
  const [draftMode, setDraftMode] = useState<TagMode>(initial.mode);
  const [draftTags, setDraftTags] = useState<TagMap>(() =>
    cloneTagMap(initial.custom)
  );
  const [baseline, setBaseline] = useState(() =>
    catalogSignature(initial.mode, initial.custom)
  );
  const [group, setGroup] = useState('3');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty = catalogSignature(draftMode, draftTags) !== baseline;
  const tags = draftTags[group] || [];

  const selectMode = (mode: TagMode) => {
    setDraftMode(mode);
    if (mode === 'custom' && !hasAnyTag(draftTags)) {
      setDraftTags(defaultTagMap());
    }
  };

  const removeTag = (tag: string) => {
    setDraftTags((current) => ({
      ...current,
      [group]: (current[group] || []).filter((item) => item !== tag),
    }));
  };

  const addTag = (event: React.FormEvent) => {
    event.preventDefault();
    const tag = normalizeTagInput(input);
    if (!tag) {
      setError(t('profile.tagsInvalid'));
      return;
    }
    if (tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setError(t('profile.tagsDuplicate'));
      return;
    }
    setDraftTags((current) => ({
      ...current,
      [group]: [...(current[group] || []), tag],
    }));
    setInput('');
    setError('');
  };

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveTagCatalog({ mode: draftMode, custom: draftTags });
      setDraftMode(saved.mode);
      setDraftTags(cloneTagMap(saved.custom));
      setBaseline(catalogSignature(saved.mode, saved.custom));
      showNotification(t('profile.tagsSaved'), notificationType.SUCCESS);
    } catch {
      showNotification(t('profile.tagsSaveError'), notificationType.ERROR);
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3 text-left">
      <div
        className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-white/[0.04]"
        role="group"
        aria-label={t('profile.tagsSource')}
      >
        <button
          type="button"
          className={modeBtn(draftMode === 'default')}
          onClick={() => selectMode('default')}
          aria-pressed={draftMode === 'default'}
        >
          {t('profile.tagsDefault')}
        </button>
        <button
          type="button"
          className={modeBtn(draftMode === 'custom')}
          onClick={() => selectMode('custom')}
          aria-pressed={draftMode === 'custom'}
        >
          {t('profile.tagsCustom')}
        </button>
      </div>

      <p className="m-0 text-xs text-app-muted leading-relaxed">
        {draftMode === 'custom'
          ? t('profile.tagsCustomHint')
          : t('profile.tagsDefaultHint')}
      </p>

      {draftMode === 'custom' && (
        <>
          <select
            className={fieldClass}
            value={group}
            aria-label={t('profile.tagsCategory')}
            onChange={(event) => {
              setGroup(event.target.value);
              setError('');
            }}
          >
            {groups.map((item) => (
              <option key={item.key} value={item.key}>
                {item.key === 'income'
                  ? t('nav.income') || item.label
                  : item.label}
                {(draftTags[item.key] || []).length
                  ? ` · ${(draftTags[item.key] || []).length}`
                  : ''}
              </option>
            ))}
          </select>

          {tags.length ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 py-1.5 pl-3 pr-1.5 rounded-full bg-white/[0.08] text-app-primary text-sm"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={t('profile.tagsRemove').replace('{tag}', tag)}
                    className="flex p-1 border-none bg-transparent text-app-muted hover:text-app-primary cursor-pointer"
                  >
                    <FiX size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="m-0 text-xs text-app-muted">{t('profile.tagsEmpty')}</p>
          )}

          <form className="flex gap-2" onSubmit={addTag}>
            <input
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (error) setError('');
              }}
              placeholder={t('profile.tagsAddPlaceholder')}
              aria-label={t('profile.tagsAddPlaceholder')}
              maxLength={80}
              disabled={busy}
              className={`${fieldClass} flex-1 min-w-0 text-base`}
            />
            <button
              type="submit"
              className={secondaryBtn}
              disabled={busy || !input.trim()}
            >
              {t('profile.tagsAdd')}
            </button>
          </form>

          {error && (
            <p className="m-0 text-xs text-red-300 leading-relaxed">{error}</p>
          )}

          <button
            type="button"
            className={`${secondaryBtn} w-full`}
            onClick={() => {
              setDraftTags(defaultTagMap());
              setError('');
            }}
            disabled={busy}
          >
            {t('profile.tagsRestore')}
          </button>
        </>
      )}

      {dirty && (
        <button
          type="button"
          className={`${BTN_SUBMIT_CLASS} w-full`}
          onClick={save}
          disabled={busy}
        >
          {busy ? <Loader variant="on-button" /> : t('profile.tagsSave')}
        </button>
      )}
    </div>
  );
};

const TagSettings = () => {
  const { t } = useLocalization();
  const { catalog, status } = useTagCatalogState();

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px]">
      <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[var(--color-app-accent)]">
        <FiHash />
        <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
          {t('profile.tagsTitle')}
        </h3>
      </div>
      {status === 'ready' ? (
        <TagEditor
          key={catalogSignature(catalog.mode, catalog.custom)}
          initial={catalog}
        />
      ) : (
        <p className="m-0 text-xs text-app-muted">{t('profile.tagsLoading')}</p>
      )}
    </div>
  );
};

export default TagSettings;
