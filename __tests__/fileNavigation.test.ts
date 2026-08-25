import {
  extractCurrentPath,
  navigateToTargetWith,
  uiPageToApiPage,
  type NavigationDependencies,
} from '../src/domain/navigation';

function createDependencies(): jest.Mocked<NavigationDependencies> {
  return {
    getCurrentFilePath: jest.fn(),
    jumpToPage: jest.fn(),
    openFile: jest.fn(),
    openNativeFallback: jest.fn(),
  };
}

describe('file navigation', () => {
  it('converts user-facing pages to official zero-based pages', () => {
    expect(uiPageToApiPage(1)).toBe(0);
    expect(uiPageToApiPage(12)).toBe(11);
    expect(uiPageToApiPage(0)).toBe(-1);
  });

  it('extracts current file paths from API responses', () => {
    expect(extractCurrentPath({success: true, result: '/Note/a.note'})).toBe('/Note/a.note');
    expect(extractCurrentPath({success: false})).toBeNull();
  });

  it('uses jumpToPage when the target is in the current file', async () => {
    const dependencies = createDependencies();
    dependencies.getCurrentFilePath.mockResolvedValue({success: true, result: '/Note/a.note'});
    dependencies.jumpToPage.mockResolvedValue({success: true, result: true});

    await navigateToTargetWith({path: '/Note/a.note', page: 5}, dependencies);

    expect(dependencies.jumpToPage).toHaveBeenCalledWith(4);
    expect(dependencies.openFile).not.toHaveBeenCalled();
    expect(dependencies.openNativeFallback).not.toHaveBeenCalled();
  });

  it('uses openFile and preserves the last page for an unlocked target', async () => {
    const dependencies = createDependencies();
    dependencies.getCurrentFilePath.mockResolvedValue({success: true, result: '/Note/a.note'});
    dependencies.openFile.mockResolvedValue({success: true, result: true});

    await navigateToTargetWith({path: '/Document/book.pdf', page: 0}, dependencies);

    expect(dependencies.openFile).toHaveBeenCalledWith('/Document/book.pdf', -1);
  });

  it('falls back when the official API fails', async () => {
    const dependencies = createDependencies();
    dependencies.getCurrentFilePath.mockRejectedValue(new Error('API unavailable'));

    await navigateToTargetWith({path: '/Document/book.pdf', page: 3}, dependencies);

    expect(dependencies.openNativeFallback).toHaveBeenCalledWith({
      path: '/Document/book.pdf',
      page: 3,
    });
  });
});
