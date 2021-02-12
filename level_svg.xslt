<?xml version="1.0"?>

<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns="http://www.w3.org/2000/svg">
    <xsl:template match="/level">
        <svg stroke-width="0.015" stroke="black"
             fill="none">
            <xsl:attribute name="viewBox">
                <!-- x -->
                <xsl:value-of select="@left - 0.02"/>
                <xsl:text> </xsl:text>
                <!-- y -->
                <xsl:value-of select="@bottom - 0.02"/>
                <xsl:text> </xsl:text>
                <!-- width -->
                <xsl:value-of select="@width + 0.04"/>
                <xsl:text> </xsl:text>
                <!-- height -->
                <xsl:value-of select="@height + 0.04"/>
            </xsl:attribute>
            <xsl:attribute name="width">
                <xsl:value-of select="(@width + 0.04) * 150"/>
            </xsl:attribute>
            <xsl:attribute name="height">
                <xsl:value-of select="(@height + 0.04) * 150"/>
            </xsl:attribute>
            <rect fill="white" stroke="none">
                <xsl:attribute name="width">
                    <xsl:value-of select="@width + 0.04"/>
                </xsl:attribute>
                <xsl:attribute name="height">
                    <xsl:value-of select="@height + 0.04"/>
                </xsl:attribute>
                <xsl:attribute name="x">
                    <xsl:value-of select="@left - 0.02"/>
                </xsl:attribute>
                <xsl:attribute name="y">
                    <xsl:value-of select="@bottom - 0.02"/>
                </xsl:attribute>
            </rect>
            <g>
                <xsl:attribute name="transform">
                    <xsl:text>translate(0,</xsl:text>
                    <xsl:value-of select="@height + 2 * @bottom"/>
                    <xsl:text>) scale(1,-1)</xsl:text>
                </xsl:attribute>
                <rect>
                    <xsl:attribute name="x">
                        <xsl:value-of select="@left"/>
                    </xsl:attribute>
                    <xsl:attribute name="y">
                        <xsl:value-of select="@bottom"/>
                    </xsl:attribute>
                    <xsl:attribute name="width">
                        <xsl:value-of select="@width"/>
                    </xsl:attribute>
                    <xsl:attribute name="height">
                        <xsl:value-of select="@height"/>
                    </xsl:attribute>
                </rect>
                <xsl:apply-templates select="*"/>
            </g>
        </svg>
    </xsl:template>

    <xsl:template match="start">
        <g id="ball">
            <path fill="black" stroke="none">
                <xsl:attribute name="d">
                    <xsl:text>M</xsl:text>
                    <xsl:value-of select="@x - 0.1"/><xsl:text>,</xsl:text>
                    <xsl:value-of select="@y"/>
                    <xsl:text> a0.1,0.1 0 0 0 0.2 0 z</xsl:text>
                </xsl:attribute>
            </path>
            <path fill="red" stroke="none">
                <xsl:attribute name="d">
                    <xsl:text>M</xsl:text>
                    <xsl:value-of select="@x - 0.1"/><xsl:text>,</xsl:text>
                    <xsl:value-of select="@y"/>
                    <xsl:text> a0.1,0.1 0 0 1 0.2 0 z</xsl:text>
                </xsl:attribute>
            </path>
        </g>
    </xsl:template>

    <xsl:template match="goal">
        <g>
            <xsl:call-template name="box"/>
            <xsl:choose>
                <xsl:when test="@width &lt; @height">
                    <xsl:call-template name="chequered-flag">
                        <xsl:with-param name="sqSize" select="@width div 2"/>
                        <xsl:with-param name="x" select="@x - @width div 2"/>
                        <xsl:with-param name="y" select="@y + @height div 2"/>
                        <xsl:with-param name="orientation" select="'vertical'"/>
                        <xsl:with-param name="length" select="@height"/>
                    </xsl:call-template>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:call-template name="chequered-flag">
                        <xsl:with-param name="sqSize" select="@height div 2"/>
                        <xsl:with-param name="x" select="@x - @width div 2"/>
                        <xsl:with-param name="y" select="@y + @height div 2"/>
                        <xsl:with-param name="orientation" select="'horizontal'"/>
                        <xsl:with-param name="length" select="@width"/>
                    </xsl:call-template>
                </xsl:otherwise>
            </xsl:choose>
        </g>
    </xsl:template>

    <xsl:template name="chequered-flag">
        <xsl:param name="x"/>
        <xsl:param name="y"/> <!-- of the top left corner -->
        <xsl:param name="orientation"/>
        <xsl:param name="length"/>
        <xsl:param name="sqSize"/>

        <!-- in any case, draw the top-left square -->
        <rect fill="black" stroke="none">
            <xsl:attribute name="x"><xsl:value-of select="$x"/></xsl:attribute>
            <xsl:attribute name="y"><xsl:value-of select="$y - $sqSize"/></xsl:attribute>
            <xsl:attribute name="width"><xsl:value-of select="$sqSize"/></xsl:attribute>
            <xsl:attribute name="height"><xsl:value-of select="$sqSize"/></xsl:attribute>
        </rect>

        <!-- draw one down and right if we can -->
        <xsl:if test="$length &gt; $sqSize">
            <rect fill="black" stroke="none">
                <xsl:attribute name="x"><xsl:value-of select="$x + $sqSize"/></xsl:attribute>
                <xsl:attribute name="y"><xsl:value-of select="$y - 2 * $sqSize"/></xsl:attribute>
                <xsl:attribute name="width"><xsl:value-of select="$sqSize"/></xsl:attribute>
                <xsl:attribute name="height"><xsl:value-of select="$sqSize"/></xsl:attribute>
            </rect>
        </xsl:if>

        <xsl:variable name="nextLength" select="$length - 2 * $sqSize"/>
        <xsl:if test="$nextLength &gt; 0.01">
            <xsl:choose>
                <xsl:when test="$orientation = 'vertical'">
                    <xsl:call-template name="chequered-flag">
                        <xsl:with-param name="sqSize" select="$sqSize"/>
                        <xsl:with-param name="x" select="$x"/>
                        <xsl:with-param name="y" select="$y - 2 * $sqSize"/>
                        <xsl:with-param name="orientation" select="$orientation"/>
                        <xsl:with-param name="length" select="$nextLength"/>
                    </xsl:call-template>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:call-template name="chequered-flag">
                        <xsl:with-param name="sqSize" select="$sqSize"/>
                        <xsl:with-param name="x" select="$x + 2 * $sqSize"/>
                        <xsl:with-param name="y" select="$y"/>
                        <xsl:with-param name="orientation" select="$orientation"/>
                        <xsl:with-param name="length" select="$nextLength"/>
                    </xsl:call-template>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:if>
    </xsl:template>

    <xsl:template match="cradle">
        <polyline>
            <xsl:attribute name="points">
                <xsl:value-of select="@x - (@width div 2)"/>
                <xsl:text>,</xsl:text>
                <xsl:value-of select="@y + @height"/>
                <xsl:text> </xsl:text>
                <xsl:value-of select="@x - (@width div 2)"/>
                <xsl:text>,</xsl:text>
                <xsl:value-of select="@y"/>
                <xsl:text> </xsl:text>
                <xsl:value-of select="@x + (@width div 2)"/>
                <xsl:text>,</xsl:text>
                <xsl:value-of select="@y"/>
                <xsl:text> </xsl:text>
                <xsl:value-of select="@x + (@width div 2)"/>
                <xsl:text>,</xsl:text>
                <xsl:value-of select="@y + @height"/>
            </xsl:attribute>
        </polyline>
    </xsl:template>

    <xsl:template match="box" name="box">
        <rect>
            <xsl:attribute name="x">
                <xsl:value-of select="@x - (@width div 2)"/>
            </xsl:attribute>
            <xsl:attribute name="y">
                <xsl:value-of select="@y - (@height div 2)"/>
            </xsl:attribute>
            <xsl:attribute name="width">
                <xsl:value-of select="@width"/>
            </xsl:attribute>
            <xsl:attribute name="height">
                <xsl:value-of select="@height"/>
            </xsl:attribute>
        </rect>
    </xsl:template>

    <xsl:template match="circle">
        <circle>
            <xsl:attribute name="cx">
                <xsl:value-of select="@x"/>
            </xsl:attribute>
            <xsl:attribute name="cy">
                <xsl:value-of select="@y"/>
            </xsl:attribute>
            <xsl:attribute name="r">
                <xsl:value-of select="@r"/>
            </xsl:attribute>
        </circle>
    </xsl:template>

    <xsl:template match="open-path">
        <polyline>
            <xsl:attribute name="points">
                <xsl:for-each select="node">
                    <xsl:if test="position() > 1"><xsl:text> </xsl:text></xsl:if>
                    <xsl:value-of select="@x"/>
                    <xsl:text>,</xsl:text>
                    <xsl:value-of select="@y"/>
                </xsl:for-each>
            </xsl:attribute>
        </polyline>
    </xsl:template>

    <xsl:template match="polygon">
        <polygon>
            <xsl:attribute name="points">
                <xsl:for-each select="node">
                    <xsl:if test="position() > 1"><xsl:text> </xsl:text></xsl:if>
                    <xsl:value-of select="@x"/>
                    <xsl:text>,</xsl:text>
                    <xsl:value-of select="@y"/>
                </xsl:for-each>
            </xsl:attribute>
        </polygon>
    </xsl:template>

</xsl:stylesheet>
