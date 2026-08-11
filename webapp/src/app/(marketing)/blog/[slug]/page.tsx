import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { listarPosts, postPorSlug } from "@/lib/blog";
import { formatarDataBr } from "@/lib/datas";

export function generateStaticParams() {
  return listarPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = postPorSlug(slug);
  if (!post) return { title: "Post não encontrado" };
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
    },
  };
}

const mdxComponents = {
  h2: (props: React.ComponentProps<"h2">) => (
    <h2
      className="mt-10 font-serif text-2xl font-light text-tinta"
      {...props}
    />
  ),
  h3: (props: React.ComponentProps<"h3">) => (
    <h3 className="mt-8 font-serif text-xl font-light text-tinta" {...props} />
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p className="mt-4 text-base leading-relaxed text-tinta/90" {...props} />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul className="mt-4 list-disc space-y-2 pl-5 text-base" {...props} />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol className="mt-4 list-decimal space-y-2 pl-5 text-base" {...props} />
  ),
  li: (props: React.ComponentProps<"li">) => (
    <li className="leading-relaxed" {...props} />
  ),
  strong: (props: React.ComponentProps<"strong">) => (
    <strong className="font-medium text-tinta" {...props} />
  ),
  em: (props: React.ComponentProps<"em">) => (
    <em className="italic text-tinta/80" {...props} />
  ),
  a: (props: React.ComponentProps<"a">) => (
    <a className="text-marca underline-offset-2 hover:underline" {...props} />
  ),
};

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = postPorSlug(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-[720px] px-4 py-16">
      <Link href="/blog" className="text-sm text-marca">
        ← Blog
      </Link>
      <header className="mt-6 space-y-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-cinza-2">
          {formatarDataBr(post.date)}
        </p>
        <h1 className="font-serif text-4xl font-light leading-tight">
          {post.title}
        </h1>
        <p className="text-lg text-cinza-2">{post.description}</p>
      </header>
      <div className="prose-blog mt-10 font-serif font-light">
        <MDXRemote source={post.content} components={mdxComponents} />
      </div>
    </article>
  );
}
